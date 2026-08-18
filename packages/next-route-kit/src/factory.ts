import {
    RoutePipeline,
    RoutePluginRegistry,
    type ErrorMapper,
    type Guard,
    type InputMetadata,
    type InputPipe,
    type Interceptor,
    type ResponseSerializer,
    type RouteContext,
    type RouteHandler,
    type RouteMiddleware,
    type RouteMeta,
    type RouteParams,
    type RouteRuntime,
} from '@next-route-kit/core'
import { InputSource } from './input.js'
import { defaultErrorMapper, InvalidJsonBodyError } from './errors.js'
import type { ResolvedRouteInput, RouteInputDefinition } from './input.js'
import type {
    AnyRouteContext,
    DefaultRouteState,
    JsonResponseOptions,
    NextRouteHandler,
    NextRouteHandlerContext,
    RootRouteFactory,
    RouteFactory,
    RouteFactoryConfig,
    RouteInputContext,
    RouteInputResolver,
    RouteOptions,
} from './types.js'

interface RouteConfigLayer<TState> {
    readonly runtime: RouteRuntime | undefined
    readonly pluginRegistry: RoutePluginRegistry
    readonly middleware: readonly RouteMiddleware<AnyRouteContext<TState>>[]
    readonly guards: readonly Guard<AnyRouteContext<TState>>[]
    readonly inputPipes: readonly InputPipe<unknown, unknown, AnyRouteContext<TState>>[]
    readonly interceptors: readonly Interceptor<AnyRouteContext<TState>>[]
    readonly errorMappers: readonly ErrorMapper<AnyRouteContext<TState>>[]
    readonly responseSerializer: ResponseSerializer<unknown, AnyRouteContext<TState>> | undefined
}

interface ResolvedRouteConfig<TState> extends RouteConfigLayer<TState> {
    readonly responseSerializer: ResponseSerializer<unknown, AnyRouteContext<TState>>
}

type FactoryMode = 'root' | 'configured'

/**
 * The application-owned Route Factory.
 *
 * A configured Factory is callable because its constructor returns a small
 * callable proxy. The class still owns configuration resolution, plugin
 * installation, immutable scope derivation, and route compilation; the proxy
 * only preserves the ergonomic `route({ handler })` API.
 */
export class Factory<TState = DefaultRouteState> {
    private readonly _config: ResolvedRouteConfig<TState>

    constructor(config: RouteFactoryConfig<TState> = {}, mode: FactoryMode = 'configured') {
        this._config = Factory.normalize(config)
        return Factory.createCallable(this, mode) as unknown as this
    }

    /** Read the compiled immutable configuration snapshot. */
    get config(): Readonly<RouteFactoryConfig<TState>> {
        return Factory.asFactoryConfig(this._config)
    }

    /**
     * Derive a child Factory without modifying this Factory.
     *
     * Array components append in global → scope order. Error mappers prepend so
     * the most local mapper gets the first chance to handle an error.
     */
    extend(config: RouteFactoryConfig<TState>): Factory<TState> {
        const child = Factory.resolveLayer(config)
        const merged = Factory.merge(this._config, child)
        return Factory.fromResolved(merged)
    }

    /**
     * Compile one native-compatible Next Route Handler from route options.
     *
     * Plugin installation and pipeline compilation happen once here, not for
     * every request.
     */
    create<TParams extends RouteParams = RouteParams, TInput = unknown, TResult = unknown>(
        options: RouteOptions<TParams, TInput, TState, TResult>,
    ): NextRouteHandler<TParams> {
        const inputDefinition = Factory.snapshotInputDefinition(options.input)
        const routeConfig = Factory.resolveLayer(Factory.pickRouteConfig(options))
        const merged = Factory.merge(this._config, routeConfig)
        const pipeline = new RoutePipeline<AnyRouteContext<TState>, unknown>({
            middleware: merged.middleware,
            guards: merged.guards,
            inputPipes: merged.inputPipes,
            interceptors: merged.interceptors,
            errorMappers: merged.errorMappers,
            responseSerializer: merged.responseSerializer,
            handler: options.handler as unknown as RouteHandler<AnyRouteContext<TState>, unknown>,
        })

        return async (request: Request, nextContext?: NextRouteHandlerContext<TParams> | { readonly params: TParams }) => {
            const state = {} as TState
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
            const context: RouteContext<TParams, ResolvedRouteInput<TInput>, TState> = {
                request,
                params: {} as TParams,
                input: undefined as ResolvedRouteInput<TInput>,
                inputMetadata: Factory.resolveInputMetadata(inputDefinition),
                state,
                meta,
            }

            return pipeline.execute(
                context as AnyRouteContext<TState>,
                async () => {
                    context.input = (await Factory.resolveInput(inputDefinition as RouteInputDefinition<TInput, TParams, TState>, {
                        request,
                        params: context.params,
                        state,
                        readBody,
                        readText,
                    })) as ResolvedRouteInput<TInput>
                },
                async (preparedContext: AnyRouteContext<TState>) => {
                    preparedContext.params = (await Promise.resolve(nextContext?.params ?? {})) as TParams
                },
            )
        }
    }

    private static normalize<TState>(config: RouteFactoryConfig<TState>): ResolvedRouteConfig<TState> {
        const layer = Factory.resolveLayer(config)
        return Factory.freeze({
            ...layer,
            errorMappers: [...layer.errorMappers, defaultErrorMapper()],
            responseSerializer: layer.responseSerializer ?? jsonResponse(),
        }) as ResolvedRouteConfig<TState>
    }

    private static freeze<TState>(config: RouteConfigLayer<TState>): Readonly<RouteConfigLayer<TState>> {
        return Object.freeze({
            ...config,
            middleware: Object.freeze([...config.middleware]),
            guards: Object.freeze([...config.guards]),
            inputPipes: Object.freeze([...config.inputPipes]),
            interceptors: Object.freeze([...config.interceptors]),
            errorMappers: Object.freeze([...config.errorMappers]),
        })
    }

    private static resolveLayer<TState>(config: RouteFactoryConfig<TState>): RouteConfigLayer<TState> {
        const pluginRegistry = new RoutePluginRegistry(config.plugins)
        const contributions = pluginRegistry.snapshot(config.runtime)
        const responseSerializer = config.responseSerializer ?? config.response ?? contributions.responseSerializer

        return {
            runtime: config.runtime,
            pluginRegistry,
            middleware: [...(config.middleware ?? []), ...contributions.middleware],
            guards: [...(config.guards ?? []), ...contributions.guards],
            inputPipes: [...(config.inputPipes ?? []), ...contributions.inputPipes],
            interceptors: [...(config.interceptors ?? []), ...contributions.interceptors],
            errorMappers: [...(config.errorMappers ?? []), ...contributions.errorMappers],
            responseSerializer: responseSerializer as ResponseSerializer<unknown, AnyRouteContext<TState>> | undefined,
        }
    }

    private static merge<TState>(parent: ResolvedRouteConfig<TState>, child: RouteConfigLayer<TState>): ResolvedRouteConfig<TState> {
        const runtime = child.runtime ?? parent.runtime
        const pluginRegistry = parent.pluginRegistry.compose(child.pluginRegistry)
        pluginRegistry.validateRuntime(runtime)

        return Factory.freeze({
            runtime,
            pluginRegistry,
            middleware: [...parent.middleware, ...child.middleware],
            guards: [...parent.guards, ...child.guards],
            inputPipes: [...parent.inputPipes, ...child.inputPipes],
            interceptors: [...parent.interceptors, ...child.interceptors],
            errorMappers: [...child.errorMappers, ...parent.errorMappers],
            responseSerializer: child.responseSerializer ?? parent.responseSerializer,
        }) as ResolvedRouteConfig<TState>
    }

    private static asFactoryConfig<TState>(config: ResolvedRouteConfig<TState>): RouteFactoryConfig<TState> {
        return Object.freeze({
            ...(config.runtime === undefined ? {} : { runtime: config.runtime }),
            middleware: config.middleware,
            guards: config.guards,
            inputPipes: config.inputPipes,
            interceptors: config.interceptors,
            errorMappers: config.errorMappers,
            responseSerializer: config.responseSerializer,
        })
    }

    private static pickRouteConfig<TParams extends RouteParams, TInput, TState, TResult>(
        options: RouteOptions<TParams, TInput, TState, TResult>,
    ): RouteFactoryConfig<TState> {
        const plugins = [...(options.plugins ?? []), ...(options.use ?? [])]

        return {
            ...(options.runtime ? { runtime: options.runtime } : {}),
            ...(options.middleware ? { middleware: options.middleware } : {}),
            ...(options.guards ? { guards: options.guards } : {}),
            ...(options.inputPipes ? { inputPipes: options.inputPipes } : {}),
            ...(options.interceptors ? { interceptors: options.interceptors } : {}),
            ...(options.errorMappers ? { errorMappers: options.errorMappers } : {}),
            ...(options.responseSerializer ? { responseSerializer: options.responseSerializer } : {}),
            ...(options.response ? { response: options.response } : {}),
            ...(plugins.length ? { plugins } : {}),
        }
    }

    private static async resolveInput<TParams extends RouteParams, TInput, TState>(
        definition: RouteInputDefinition<TInput, TParams, TState>,
        context: RouteInputContext<TParams, TState>,
    ): Promise<ResolvedRouteInput<TInput>> {
        if (definition instanceof InputSource) {
            return (await definition.resolve(context)) as ResolvedRouteInput<TInput>
        }

        if (typeof definition === 'function') {
            return (await (definition as RouteInputResolver<TParams, ResolvedRouteInput<TInput>, TState>)(context)) as ResolvedRouteInput<TInput>
        }

        if (Factory.isInputSourceMap(definition)) {
            const resolvedEntries = await Promise.all(
                Object.entries(definition).map(async ([key, value]) => [key, value instanceof InputSource ? await value.resolve(context) : value] as const),
            )
            return Object.fromEntries(resolvedEntries) as ResolvedRouteInput<TInput>
        }

        return definition as ResolvedRouteInput<TInput>
    }

    private static resolveInputMetadata<TDefinition>(definition: TDefinition): InputMetadata {
        if (definition instanceof InputSource) {
            return Factory.freezeInputMetadata({ location: definition.location, name: definition.name })
        }

        if (Factory.isInputSourceMap(definition)) {
            const fields = Object.fromEntries(
                Object.entries(definition).map(([key, value]) => [
                    key,
                    value instanceof InputSource
                        ? Factory.freezeInputMetadata({ location: value.location, name: value.name })
                        : Factory.freezeInputMetadata({ location: 'custom', name: key }),
                ]),
            )

            return Factory.freezeInputMetadata({ location: 'custom', name: 'route-input', fields })
        }

        return Factory.freezeInputMetadata({ location: 'custom', name: 'route-input' })
    }

    private static freezeInputMetadata(metadata: InputMetadata): InputMetadata {
        if (!metadata.fields) {
            return Object.freeze({ ...metadata })
        }

        return Object.freeze({
            ...metadata,
            fields: Object.freeze({ ...metadata.fields }),
        })
    }

    private static snapshotInputDefinition<TDefinition>(definition: TDefinition): TDefinition {
        if (Factory.isInputSourceMap(definition)) {
            return Object.freeze({ ...definition }) as TDefinition
        }

        return definition
    }

    private static isInputSourceMap(value: unknown): value is Readonly<Record<string, unknown>> {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false
        }

        const values = Object.values(value)
        return values.some((item) => item instanceof InputSource)
    }

    private static resolvePathname(request: Request): string | undefined {
        try {
            return new URL(request.url).pathname
        } catch {
            return undefined
        }
    }

    private static fromResolved<TState>(config: ResolvedRouteConfig<TState>): Factory<TState> {
        const owner = Object.create(Factory.prototype) as Factory<TState>
        Object.defineProperty(owner, '_config', {
            configurable: false,
            enumerable: false,
            value: config,
            writable: false,
        })

        return Factory.createCallable(owner)
    }

    private static createCallable<TState>(owner: Factory<TState>, mode: FactoryMode = 'configured'): Factory<TState> {
        const callable =
            mode === 'root'
                ? (childConfig: RouteFactoryConfig<TState> = {}) => new Factory(childConfig)
                : <TParams extends RouteParams = RouteParams, TInput = unknown, TResult = unknown>(options: RouteOptions<TParams, TInput, TState, TResult>) =>
                      owner.create(options)

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
        return proxy as unknown as Factory<TState>
    }
}

export interface Factory<TState = DefaultRouteState> extends RouteFactory<TState> {}

/** Callable root instance: `const route = createRoute({ ...config })`. */
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
