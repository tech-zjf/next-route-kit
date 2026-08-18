export type MaybePromise<T> = T | Promise<T>

export type RouteRuntime = 'nodejs' | 'edge'

export type RuntimeSupport = RouteRuntime | 'both'

export type RouteParams = Record<string, string | string[]>

export interface RouteMeta {
    readonly method?: string
    readonly pathname?: string
    readonly runtime?: RouteRuntime
    readonly [key: string]: unknown
}

export interface InputMetadata {
    readonly location: 'body' | 'query' | 'params' | 'headers' | 'custom'
    readonly name?: string
}

export interface RouteContext<TParams extends RouteParams = RouteParams, TInput = unknown, TState = Record<string, never>> {
    request: Request
    params: TParams
    input: TInput
    state: TState
    meta: RouteMeta
}

export type AnyRouteContext = RouteContext<any, any, any>

export interface RouteConfig<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly plugins?: readonly RoutePlugin[]
    readonly middleware?: readonly RouteMiddleware<TContext>[]
    readonly guards?: readonly Guard<TContext>[]
    readonly inputPipes?: readonly InputPipe<unknown, unknown, TContext>[]
    readonly interceptors?: readonly Interceptor<TContext>[]
    readonly errorMappers?: readonly ErrorMapper<TContext>[]
    readonly responseSerializer?: ResponseSerializer<TResult, TContext>
}

export type RouteHandler<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> = (context: TContext) => MaybePromise<TResult>

export interface RouteOptions<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> extends RouteConfig<TContext, TResult> {
    readonly handler: RouteHandler<TContext, TResult>
}

export interface RouteMiddleware<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    handle(context: TContext, next: () => Promise<unknown>): MaybePromise<unknown>
}

export interface Guard<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    canActivate(context: TContext): MaybePromise<boolean | Response>
}

export interface InputPipe<TInput = unknown, TOutput = TInput, TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    transform(value: TInput, metadata: InputMetadata, context: TContext): MaybePromise<TOutput>
}

export interface Interceptor<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    intercept(context: TContext, next: () => Promise<unknown>): Promise<unknown>
}

export interface ErrorMapper<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    map(error: unknown, context: TContext): MaybePromise<Response | undefined>
}

export interface ResponseSerializer<TValue = unknown, TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    serialize(value: TValue, context: TContext): MaybePromise<Response>
}

export interface RoutePluginContribution {
    readonly middleware?: readonly RouteMiddleware[]
    readonly guards?: readonly Guard[]
    readonly inputPipes?: readonly InputPipe[]
    readonly interceptors?: readonly Interceptor[]
    readonly errorMappers?: readonly ErrorMapper[]
    readonly responseSerializer?: ResponseSerializer
}

export interface RoutePlugin {
    readonly name: string
    readonly runtime?: RuntimeSupport

    install(): RoutePluginContribution
}
