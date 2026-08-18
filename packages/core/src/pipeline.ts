import { DuplicateMiddlewareNextError, MissingResponseSerializerError, forbidden } from './errors.js'
import type {
    AnyRouteContext,
    ArgumentMetadata,
    ExceptionFilter,
    Guard,
    Interceptor,
    MaybePromise,
    Pipe,
    ResponseSerializer,
    RouteHandler,
    RouteMiddleware,
} from './types.js'

export interface RoutePipelineDefinition<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly middleware?: readonly RouteMiddleware<TContext>[]
    readonly guards?: readonly Guard<TContext>[]
    readonly pipes?: readonly Pipe<unknown, unknown, TContext>[]
    readonly interceptors?: readonly Interceptor<TContext>[]
    readonly exceptionFilters?: readonly ExceptionFilter<TContext>[]
    readonly responseSerializer?: ResponseSerializer<TResult, TContext>
    readonly handler: RouteHandler<TContext, TResult>
}

export type RoutePreparation<TContext extends AnyRouteContext = AnyRouteContext> = (context: TContext) => MaybePromise<void>

/**
 * Adapter-owned context hydration that must complete before middleware runs.
 * Hydrating framework metadata such as dynamic params must not consume the
 * request body or run user-defined argument pipes.
 */
export type RouteContextPreparation<TContext extends AnyRouteContext = AnyRouteContext> = RoutePreparation<TContext>

function isResponse(value: unknown): value is Response {
    return typeof Response !== 'undefined' && value instanceof Response
}

/**
 * Compiled request pipeline.
 *
 * The order follows the familiar request-processing mental model while keeping
 * Next's native Request/Response boundary intact:
 *
 * Middleware → Guards → Interceptors (enter) → argument preparation → Pipes
 * → Handler → Interceptors (exit) → Middleware (exit) → serialization.
 */
export class RoutePipeline<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly middleware: readonly RouteMiddleware<TContext>[]
    readonly guards: readonly Guard<TContext>[]
    readonly pipes: readonly Pipe<unknown, unknown, TContext>[]
    readonly interceptors: readonly Interceptor<TContext>[]
    readonly exceptionFilters: readonly ExceptionFilter<TContext>[]
    readonly responseSerializer: ResponseSerializer<unknown, TContext> | undefined

    private readonly handler: RouteHandler<TContext, TResult>

    constructor(definition: RoutePipelineDefinition<TContext, TResult>) {
        this.middleware = Object.freeze([...(definition.middleware ?? [])])
        this.guards = Object.freeze([...(definition.guards ?? [])])
        this.pipes = Object.freeze([...(definition.pipes ?? [])])
        this.interceptors = Object.freeze([...(definition.interceptors ?? [])])
        this.exceptionFilters = Object.freeze([...(definition.exceptionFilters ?? [])])
        this.responseSerializer = definition.responseSerializer as ResponseSerializer<unknown, TContext> | undefined
        this.handler = definition.handler
    }

    /**
     * Execute the compiled pipeline for one request context.
     *
     * prepareContext hydrates framework metadata before middleware. prepare
     * resolves only the arguments declared by the adapter after guards and
     * inside the interceptor boundary.
     */
    async execute(context: TContext, prepare?: RoutePreparation<TContext>, prepareContext?: RouteContextPreparation<TContext>): Promise<Response> {
        const runHandlerStages = async (): Promise<unknown> => {
            await prepare?.(context)
            await this.runPipes(context)
            return this.handler(context)
        }

        const runProtectedStages = async (): Promise<unknown> => {
            const guardResponse = await this.runGuards(context)

            if (guardResponse) {
                return guardResponse
            }

            return this.runInterceptors(context, runHandlerStages)
        }

        try {
            await prepareContext?.(context)
            const result = await this.runMiddleware(context, runProtectedStages)
            return this.serializeResult(result, context)
        } catch (error) {
            for (const filter of this.exceptionFilters) {
                const response = await filter.catch(error, context)

                if (response) {
                    return response
                }
            }

            throw error
        }
    }

    private async serializeResult(value: unknown, context: TContext): Promise<Response> {
        if (isResponse(value)) {
            return value
        }

        if (!this.responseSerializer) {
            throw new MissingResponseSerializerError()
        }

        return this.responseSerializer.serialize(value, context)
    }

    private async runMiddleware(context: TContext, nextStage: () => Promise<unknown>, index = 0): Promise<unknown> {
        const current = this.middleware[index]

        if (!current) {
            return nextStage()
        }

        let nextCalled = false

        return current.use(context, async () => {
            if (nextCalled) {
                throw new DuplicateMiddlewareNextError(current.name)
            }

            nextCalled = true
            return this.runMiddleware(context, nextStage, index + 1)
        })
    }

    private async runInterceptors(context: TContext, nextStage: () => Promise<unknown>, index = 0): Promise<unknown> {
        const current = this.interceptors[index]

        if (!current) {
            return nextStage()
        }

        return current.intercept(context, () => this.runInterceptors(context, nextStage, index + 1))
    }

    private async runGuards(context: TContext): Promise<Response | undefined> {
        for (const guard of this.guards) {
            const result = await guard.canActivate(context)

            if (isResponse(result)) {
                return result
            }

            if (!result) {
                throw forbidden()
            }
        }

        return undefined
    }

    private async runPipes(context: TContext): Promise<void> {
        if (!context.argumentMetadata) {
            return
        }

        const fields = context.argumentMetadata?.fields

        if (fields) {
            for (const [name, metadata] of Object.entries(fields)) {
                let value = context.args[name]

                for (const pipe of this.pipes) {
                    value = await pipe.transform(value, metadata, context)
                }

                context.args = { ...context.args, [name]: value } as TContext['args']
            }

            return
        }

        const metadata: ArgumentMetadata = context.argumentMetadata
        let value: unknown = context.args

        for (const pipe of this.pipes) {
            value = await pipe.transform(value, metadata, context)
            context.args = value as TContext['args']
        }
    }
}

/**
 * Functional entry point retained for framework adapters and low-level users.
 * New adapters should construct and retain a RoutePipeline instance.
 */
export function executeRoutePipeline<TContext extends AnyRouteContext, TResult>(
    definition: RoutePipelineDefinition<TContext, TResult>,
    context: TContext,
    prepare?: RoutePreparation<TContext>,
): Promise<Response> {
    return new RoutePipeline(definition).execute(context, prepare)
}
