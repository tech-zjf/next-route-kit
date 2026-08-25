import {
    RoutePipeline,
    RoutePluginRegistry,
    type ArgumentMetadata,
    type ExceptionFilter,
    type Guard,
    type Interceptor,
    type Pipe,
    type ResponseSerializer,
    type RouteContext,
    type RouteMeta,
    type RouteMiddleware,
    type RouteParams,
    type RouteParamsConstraint,
    type RouteRuntime,
} from '@next-route-kit/core'
import { InputSource } from './input.js'
import { defaultExceptionFilter, InvalidJsonBodyError } from './errors.js'
import type { RouteInputDefinition } from './input.js'
import type {
    AnyRouteContext,
    DefaultRouteLocals,
    JsonResponseOptions,
    NextRouteHandler,
    NextRouteHandlerContext,
    RootRouteFactory,
    RouteFactory,
    RouteFactoryConfig,
    RouteHandlerContext,
    RouteInputContext,
    RouteOptions,
} from './types.js'

type RouteArgumentDefinitions<TParams extends RouteParamsConstraint<TParams>, TLocals> = Readonly<{
    readonly body?: RouteInputDefinition<unknown, TParams, TLocals>
    readonly query?: RouteInputDefinition<unknown, TParams, TLocals>
}>

interface RouteConfigLayer<TLocals> {
    readonly runtime: RouteRuntime | undefined
    readonly pluginRegistry: RoutePluginRegistry
    readonly middleware: readonly RouteMiddleware<AnyRouteContext<TLocals>>[]
    readonly guards: readonly Guard<AnyRouteContext<TLocals>>[]
    readonly pipes: readonly Pipe<unknown, unknown, AnyRouteContext<TLocals>>[]
    readonly interceptors: readonly Interceptor<AnyRouteContext<TLocals>>[]
    readonly exceptionFilters: readonly ExceptionFilter<AnyRouteContext<TLocals>>[]
    readonly responseSerializer: ResponseSerializer<unknown, AnyRouteContext<TLocals>> | undefined
}

interface ResolvedRouteConfig<TLocals> extends RouteConfigLayer<TLocals> {
    readonly responseSerializer: ResponseSerializer<unknown, AnyRouteContext<TLocals>>
}

type FactoryMode = 'root' | 'configured'

/**
 * The application-owned Route Factory.
 *
 * A configured Factory is callable because its constructor returns a small
 * callable proxy. The class owns configuration resolution, plugin
 * installation, immutable scope derivation, and route compilation; the proxy
 * only preserves the ergonomic route({ handler }) API.
 */
export class Factory<TLocals = DefaultRouteLocals> {
    private readonly _config: ResolvedRouteConfig<TLocals>

    constructor(config: RouteFactoryConfig<TLocals> = {}, mode: FactoryMode = 'configured') {
        this._config = Factory.normalize(config)
        return Factory.createCallable(this, mode) as unknown as this
    }

    /** Read the compiled immutable configuration snapshot. */
    get config(): Readonly<RouteFactoryConfig<TLocals>> {
        return Factory.asFactoryConfig(this._config)
    }

    /**
     * Derive a child Factory without modifying this Factory.
     *
     * Array components append in global → scope order. Exception filters
     * prepend so a route-local filter gets the first chance to handle errors.
     */
    extend(config: RouteFactoryConfig<TLocals>): Factory<TLocals> {
        const child = Factory.resolveLayer(config, config.runtime ?? this._config.runtime)
        const merged = Factory.merge(this._config, child)
        return Factory.fromResolved(merged)
    }

    /**
     * Compile one native-compatible Next Route Handler from route options.
     *
     * Plugin installation and pipeline compilation happen once here, not for
     * every request.
     */
    create<TParams extends RouteParamsConstraint<TParams> = RouteParams, TBody = never, TQuery = never, TResult = unknown>(
        options: RouteOptions<TParams, TBody, TQuery, TLocals, TResult>,
    ): NextRouteHandler<TParams> {
        const argumentDefinitions = Factory.snapshotArgumentDefinitions<TParams, TBody, TQuery, TLocals>(options.body, options.query)
        const routeConfig = Factory.resolveLayer(Factory.pickRouteConfig(options), options.runtime ?? this._config.runtime)
        const merged = Factory.merge(this._config, routeConfig)
        const pipeline = new RoutePipeline<AnyRouteContext<TLocals>, unknown>({
            middleware: merged.middleware,
            guards: merged.guards,
            pipes: merged.pipes,
            interceptors: merged.interceptors,
            exceptionFilters: merged.exceptionFilters,
            responseSerializer: merged.responseSerializer,
            handler: async (context) => {
                const handlerContext = Factory.createHandlerContext<TParams, TBody, TQuery, TLocals>(context, argumentDefinitions)
                return options.handler(context.request, handlerContext as RouteHandlerContext<TParams, TBody, TQuery, TLocals>)
            },
        })

        return async (request: Request, nextContext?: NextRouteHandlerContext<TParams> | { readonly params: TParams }) => {
            const locals = {} as TLocals
            let bodyTextPromise: Promise<string> | undefined
            let bodyPromise: Promise<unknown> | undefined

            const readText = (): Promise<string> => {
                bodyTextPromise ??= request.text()
                return bodyTextPromise
            }
            const readBody = <T>(): Promise<T> => {
                bodyPromise ??= readText().then((text) => {
                    try {
                        return JSON.parse(text) as unknown
                    } catch (error) {
                        throw new InvalidJsonBodyError(error)
                    }
                })
                return bodyPromise as Promise<T>
            }

            const pathname = Factory.resolvePathname(request)
            const meta: RouteMeta = {
                ...(pathname === undefined ? { method: request.method } : { method: request.method, pathname }),
                ...(merged.runtime === undefined ? {} : { runtime: merged.runtime }),
            }
            const argumentMetadata = Factory.resolveArgumentMetadata(argumentDefinitions)
            const context: RouteContext<TParams, Record<string, unknown>, TLocals> = {
                request,
                params: {} as TParams,
                args: {},
                ...(argumentMetadata === undefined ? {} : { argumentMetadata }),
                locals,
                meta,
            }

            return pipeline.execute(
                context as AnyRouteContext<TLocals>,
                async () => {
                    const resolvedEntries = await Promise.all(
                        Object.entries(argumentDefinitions).map(async ([name, definition]) => {
                            const value = await Factory.resolveArgument(definition, {
                                request,
                                params: context.params,
                                locals,
                                readBody,
                                readText,
                            })

                            return [name, value] as const
                        }),
                    )

                    context.args = Object.fromEntries(resolvedEntries)
                },
                async (preparedContext: AnyRouteContext<TLocals>) => {
                    preparedContext.params = (await Promise.resolve(nextContext?.params ?? {})) as TParams
                },
            )
        }
    }

    private static normalize<TLocals>(config: RouteFactoryConfig<TLocals>): ResolvedRouteConfig<TLocals> {
        const layer = Factory.resolveLayer(config, config.runtime)
        return Factory.freeze({
            ...layer,
            exceptionFilters: [...layer.exceptionFilters, defaultExceptionFilter()],
            responseSerializer: layer.responseSerializer ?? jsonResponse(),
        }) as ResolvedRouteConfig<TLocals>
    }

    private static freeze<TLocals>(config: RouteConfigLayer<TLocals>): Readonly<RouteConfigLayer<TLocals>> {
        return Object.freeze({
            ...config,
            middleware: Object.freeze([...config.middleware]),
            guards: Object.freeze([...config.guards]),
            pipes: Object.freeze([...config.pipes]),
            interceptors: Object.freeze([...config.interceptors]),
            exceptionFilters: Object.freeze([...config.exceptionFilters]),
        })
    }

    private static resolveLayer<TLocals>(config: RouteFactoryConfig<TLocals>, validationRuntime = config.runtime): RouteConfigLayer<TLocals> {
        const pluginRegistry = new RoutePluginRegistry(config.plugins, validationRuntime)
        const contributions = pluginRegistry.snapshot(validationRuntime)
        const responseSerializer = config.responseSerializer ?? config.response ?? contributions.responseSerializer

        return {
            runtime: config.runtime,
            pluginRegistry,
            middleware: [...(config.middleware ?? []), ...contributions.middleware],
            guards: [...(config.guards ?? []), ...contributions.guards],
            pipes: [...(config.pipes ?? []), ...contributions.pipes],
            interceptors: [...(config.interceptors ?? []), ...contributions.interceptors],
            exceptionFilters: [...(config.exceptionFilters ?? []), ...contributions.exceptionFilters],
            responseSerializer: responseSerializer as ResponseSerializer<unknown, AnyRouteContext<TLocals>> | undefined,
        }
    }

    private static merge<TLocals>(parent: ResolvedRouteConfig<TLocals>, child: RouteConfigLayer<TLocals>): ResolvedRouteConfig<TLocals> {
        const runtime = child.runtime ?? parent.runtime
        const pluginRegistry = parent.pluginRegistry.compose(child.pluginRegistry)
        pluginRegistry.validateRuntime(runtime)

        return Factory.freeze({
            runtime,
            pluginRegistry,
            middleware: [...parent.middleware, ...child.middleware],
            guards: [...parent.guards, ...child.guards],
            pipes: [...parent.pipes, ...child.pipes],
            interceptors: [...parent.interceptors, ...child.interceptors],
            exceptionFilters: [...child.exceptionFilters, ...parent.exceptionFilters],
            responseSerializer: child.responseSerializer ?? parent.responseSerializer,
        }) as ResolvedRouteConfig<TLocals>
    }

    private static asFactoryConfig<TLocals>(config: ResolvedRouteConfig<TLocals>): RouteFactoryConfig<TLocals> {
        return Object.freeze({
            ...(config.runtime === undefined ? {} : { runtime: config.runtime }),
            plugins: config.pluginRegistry.plugins,
            middleware: config.middleware,
            guards: config.guards,
            pipes: config.pipes,
            interceptors: config.interceptors,
            exceptionFilters: config.exceptionFilters,
            responseSerializer: config.responseSerializer,
        })
    }

    private static pickRouteConfig<TParams extends RouteParamsConstraint<TParams>, TBody, TQuery, TLocals, TResult>(
        options: RouteOptions<TParams, TBody, TQuery, TLocals, TResult>,
    ): RouteFactoryConfig<TLocals> {
        const plugins = [...(options.plugins ?? []), ...(options.use ?? [])]

        return {
            ...(options.runtime ? { runtime: options.runtime } : {}),
            ...(options.middleware ? { middleware: options.middleware } : {}),
            ...(options.guards ? { guards: options.guards } : {}),
            ...(options.pipes ? { pipes: options.pipes } : {}),
            ...(options.interceptors ? { interceptors: options.interceptors } : {}),
            ...(options.exceptionFilters ? { exceptionFilters: options.exceptionFilters } : {}),
            ...(options.responseSerializer ? { responseSerializer: options.responseSerializer } : {}),
            ...(options.response ? { response: options.response } : {}),
            ...(plugins.length ? { plugins } : {}),
        }
    }

    private static async resolveArgument<TParams extends RouteParamsConstraint<TParams>, TLocals>(
        definition: RouteInputDefinition<unknown, TParams, TLocals>,
        context: RouteInputContext<TParams, TLocals>,
    ): Promise<unknown> {
        if (definition instanceof InputSource) {
            return definition.resolve(context)
        }

        return definition(context)
    }

    private static resolveArgumentMetadata<TParams extends RouteParamsConstraint<TParams>, TLocals>(
        definitions: RouteArgumentDefinitions<TParams, TLocals>,
    ): ArgumentMetadata | undefined {
        const fields = Object.fromEntries(
            Object.entries(definitions).map(([name, definition]) => [
                name,
                Factory.freezeArgumentMetadata({
                    // The field key is the public input location even when the
                    // resolver is a custom function rather than an InputSource.
                    // Pipes such as zodPipe({ appliesTo: 'body' }) must not
                    // lose that information just because parsing is customized.
                    type: definition instanceof InputSource ? definition.location : name === 'body' || name === 'query' ? name : 'custom',
                    name: definition instanceof InputSource ? definition.name : name,
                }),
            ]),
        )

        if (Object.keys(fields).length === 0) {
            return undefined
        }

        return Factory.freezeArgumentMetadata({
            type: 'custom',
            name: 'route-arguments',
            fields,
        })
    }

    private static freezeArgumentMetadata(metadata: ArgumentMetadata): ArgumentMetadata {
        if (!metadata.fields) {
            return Object.freeze({ ...metadata })
        }

        return Object.freeze({
            ...metadata,
            fields: Object.freeze({ ...metadata.fields }),
        })
    }

    private static snapshotArgumentDefinitions<TParams extends RouteParamsConstraint<TParams>, TBody, TQuery, TLocals>(
        body: RouteInputDefinition<TBody, TParams, TLocals> | undefined,
        query: RouteInputDefinition<TQuery, TParams, TLocals> | undefined,
    ): RouteArgumentDefinitions<TParams, TLocals> {
        return Object.freeze({
            ...(body === undefined ? {} : { body: body as RouteInputDefinition<unknown, TParams, TLocals> }),
            ...(query === undefined ? {} : { query: query as RouteInputDefinition<unknown, TParams, TLocals> }),
        })
    }

    private static createHandlerContext<TParams extends RouteParamsConstraint<TParams>, TBody, TQuery, TLocals>(
        context: AnyRouteContext<TLocals>,
        definitions: RouteArgumentDefinitions<TParams, TLocals>,
    ): RouteHandlerContext<TParams, TBody, TQuery, TLocals> {
        return {
            params: context.params as TParams,
            locals: context.locals,
            meta: context.meta,
            ...(Object.hasOwn(definitions, 'body') ? { body: context.args.body as TBody } : {}),
            ...(Object.hasOwn(definitions, 'query') ? { query: context.args.query as TQuery } : {}),
        } as RouteHandlerContext<TParams, TBody, TQuery, TLocals>
    }

    private static resolvePathname(request: Request): string | undefined {
        try {
            return new URL(request.url).pathname
        } catch {
            return undefined
        }
    }

    private static fromResolved<TLocals>(config: ResolvedRouteConfig<TLocals>): Factory<TLocals> {
        const owner = Object.create(Factory.prototype) as Factory<TLocals>
        Object.defineProperty(owner, '_config', {
            configurable: false,
            enumerable: false,
            value: config,
            writable: false,
        })

        return Factory.createCallable(owner)
    }

    private static createCallable<TLocals>(owner: Factory<TLocals>, mode: FactoryMode = 'configured'): Factory<TLocals> {
        const callable =
            mode === 'root'
                ? (childConfig: RouteFactoryConfig<TLocals> = {}) => new Factory(childConfig)
                : <TParams extends RouteParamsConstraint<TParams> = RouteParams, TBody = never, TQuery = never, TResult = unknown>(
                      options: RouteOptions<TParams, TBody, TQuery, TLocals, TResult>,
                  ) => owner.create(options)

        const proxy = new Proxy(callable, {
            get(target, property, receiver) {
                if (property in owner) {
                    const value = Reflect.get(owner, property, owner)
                    return typeof value === 'function' ? value.bind(owner) : value
                }

                return Reflect.get(target, property, receiver)
            },
            set() {
                return false
            },
        })

        Object.setPrototypeOf(proxy, Factory.prototype)
        Object.freeze(proxy)
        return proxy as unknown as Factory<TLocals>
    }
}

export interface Factory<TLocals = DefaultRouteLocals> extends RouteFactory<TLocals> {}

/** Callable root instance: const route = createRoute({ ...config }). */
export const createRoute: RootRouteFactory = new Factory({}, 'root') as unknown as RootRouteFactory

export function jsonResponse<TContext extends RouteContext<any, any, any> = RouteContext<any, any, any>>(
    options: JsonResponseOptions<TContext> = {},
): ResponseSerializer<unknown, TContext> {
    return {
        name: 'json',
        async serialize(value, context) {
            const transformed = options.transform ? await options.transform(value, context) : value

            if (transformed === undefined) {
                throw new TypeError('A route handler must return a JSON value or a Response')
            }

            const responseInit: ResponseInit = {}

            if (options.status !== undefined) {
                responseInit.status = options.status
            }

            if (options.headers !== undefined) {
                responseInit.headers = options.headers
            }

            return Response.json(transformed, responseInit)
        },
    }
}
