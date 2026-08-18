import type {
    ErrorMapper,
    Guard,
    InputPipe,
    Interceptor,
    MaybePromise,
    ResponseSerializer,
    RouteConfig,
    RouteContext,
    RouteHandler,
    RouteMiddleware,
    RouteParams,
    RoutePlugin,
} from '@next-route-kit/core'
import type { ResolvedRouteInput, RouteInputDefinition } from './input.js'

export type DefaultRouteState = Record<string, never>

export type AnyRouteContext<TState> = RouteContext<any, any, TState>

export interface NextRouteHandlerContext<TParams extends RouteParams = RouteParams> {
    readonly params: Promise<TParams> | TParams
}

export type NextRouteHandler<TParams extends RouteParams = RouteParams> = (
    request: Request,
    context?: NextRouteHandlerContext<TParams>,
) => MaybePromise<Response>

export interface RouteInputContext<TParams extends RouteParams = RouteParams, TState = DefaultRouteState> {
    readonly request: Request
    readonly params: TParams
    readonly state: TState
    /** Lazily parses JSON and reuses the same parsed value on later calls. */
    readonly readBody: <T = unknown>() => Promise<T>
    /** Lazily reads text while sharing the underlying one-shot Request stream. */
    readonly readText: () => Promise<string>
}

export type RouteInputResolver<TParams extends RouteParams = RouteParams, TInput = unknown, TState = DefaultRouteState> = (
    context: RouteInputContext<TParams, TState>,
) => MaybePromise<TInput>

export interface RouteFactoryConfig<TState = DefaultRouteState> extends RouteConfig<AnyRouteContext<TState>, unknown> {
    /** User-facing alias for responseSerializer. */
    readonly response?: ResponseSerializer<unknown, AnyRouteContext<TState>>
}

export interface RouteOptions<TParams extends RouteParams = RouteParams, TInput = unknown, TState = DefaultRouteState, TResult = unknown> extends RouteConfig<
    AnyRouteContext<TState>,
    TResult
> {
    readonly input?: RouteInputDefinition<TInput, TParams, TState>
    /** User-facing alias for a route-local responseSerializer. */
    readonly response?: ResponseSerializer<unknown, AnyRouteContext<TState>>
    /** Route-local plugins; use is kept as the concise route-level spelling. */
    readonly use?: readonly RoutePlugin[]
    readonly handler: RouteHandler<RouteContext<TParams, ResolvedRouteInput<TInput>, TState>, TResult>
}

export interface RouteFactory<TState = DefaultRouteState> {
    readonly config: Readonly<RouteFactoryConfig<TState>>

    <TParams extends RouteParams = RouteParams, TInput = unknown, TResult = unknown>(
        options: RouteOptions<TParams, TInput, TState, TResult>,
    ): NextRouteHandler<TParams>

    extend(config: RouteFactoryConfig<TState>): RouteFactory<TState>
}

export interface RootRouteFactory {
    <TState = DefaultRouteState>(config?: RouteFactoryConfig<TState>): RouteFactory<TState>
}

export interface JsonResponseOptions<TContext extends RouteContext<any, any, any> = RouteContext<any, any, any>> {
    readonly status?: number
    readonly headers?: HeadersInit
    readonly transform?: (value: unknown, context: TContext) => MaybePromise<unknown>
}

export type PublicRouteConfig<TState = DefaultRouteState> = RouteFactoryConfig<TState>

export type PublicRouteComponent<TState = DefaultRouteState> =
    | RouteMiddleware<AnyRouteContext<TState>>
    | Guard<AnyRouteContext<TState>>
    | InputPipe<unknown, unknown, AnyRouteContext<TState>>
    | Interceptor<AnyRouteContext<TState>>
    | ErrorMapper<AnyRouteContext<TState>>
