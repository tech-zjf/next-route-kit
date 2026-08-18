import { DuplicateMiddlewareNextError, MissingResponseSerializerError, forbidden } from './errors.js'
import type { AnyRouteContext, ErrorMapper, Guard, InputPipe, Interceptor, MaybePromise, ResponseSerializer, RouteHandler, RouteMiddleware } from './types.js'

export interface RoutePipelineDefinition<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly middleware?: readonly RouteMiddleware<TContext>[]
    readonly guards?: readonly Guard<TContext>[]
    readonly inputPipes?: readonly InputPipe<unknown, unknown, TContext>[]
    readonly interceptors?: readonly Interceptor<TContext>[]
    readonly errorMappers?: readonly ErrorMapper<TContext>[]
    readonly responseSerializer?: ResponseSerializer<TResult, TContext>
    readonly handler: RouteHandler<TContext, TResult>
}

export type RoutePreparation<TContext extends AnyRouteContext = AnyRouteContext> = (context: TContext) => MaybePromise<void>

function isResponse(value: unknown): value is Response {
    return typeof Response !== 'undefined' && value instanceof Response
}

/**
 * Compiled request pipeline.
 *
 * A pipeline owns its stage order and immutable component lists. Framework
 * adapters should compile one instance while creating a Route Handler and
 * reuse it for every request handled by that route.
 */
export class RoutePipeline<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly middleware: readonly RouteMiddleware<TContext>[]
    readonly guards: readonly Guard<TContext>[]
    readonly inputPipes: readonly InputPipe<unknown, unknown, TContext>[]
    readonly interceptors: readonly Interceptor<TContext>[]
    readonly errorMappers: readonly ErrorMapper<TContext>[]
    readonly responseSerializer: ResponseSerializer<unknown, TContext> | undefined

    private readonly handler: RouteHandler<TContext, TResult>

    constructor(definition: RoutePipelineDefinition<TContext, TResult>) {
        this.middleware = Object.freeze([...(definition.middleware ?? [])])
        this.guards = Object.freeze([...(definition.guards ?? [])])
        this.inputPipes = Object.freeze([...(definition.inputPipes ?? [])])
        this.interceptors = Object.freeze([...(definition.interceptors ?? [])])
        this.errorMappers = Object.freeze([...(definition.errorMappers ?? [])])
        this.responseSerializer = definition.responseSerializer as ResponseSerializer<unknown, TContext> | undefined
        this.handler = definition.handler
    }

    /** Execute the compiled pipeline for one request context. */
    async execute(context: TContext, prepare?: RoutePreparation<TContext>): Promise<Response> {
        const runProtectedStages = async (): Promise<unknown> => {
            const guardResponse = await this.runGuards(context)

            if (guardResponse) {
                return guardResponse
            }

            return this.runInterceptors(context, async () => {
                await this.runInputPipes(context)
                return this.handler(context)
            })
        }

        try {
            await prepare?.(context)
            const result = await this.runMiddleware(context, runProtectedStages)
            return this.serializeResult(result, context)
        } catch (error) {
            for (const mapper of this.errorMappers) {
                const response = await mapper.map(error, context)

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

        return current.handle(context, async () => {
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

    private async runInputPipes(context: TContext): Promise<void> {
        let input: unknown = context.input

        for (const pipe of this.inputPipes) {
            input = await pipe.transform(input, { location: 'custom', name: 'route-input' }, context)
            context.input = input as TContext['input']
        }
    }
}

/**
 * Compatibility helper for callers that used the original functional Core
 * API. New adapters should construct and retain a `RoutePipeline` instance.
 */
export function executeRoutePipeline<TContext extends AnyRouteContext, TResult>(
    definition: RoutePipelineDefinition<TContext, TResult>,
    context: TContext,
    prepare?: RoutePreparation<TContext>,
): Promise<Response> {
    return new RoutePipeline(definition).execute(context, prepare)
}
