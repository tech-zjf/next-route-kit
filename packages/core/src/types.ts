export type MaybePromise<T> = T | Promise<T>

export type RouteRuntime = 'nodejs' | 'edge'

export type RuntimeSupport = RouteRuntime | 'both'

export type RouteParamValue = string | string[] | undefined

/** Default dynamic route parameter shape used when a route has no custom type. */
export type RouteParams = Record<string, RouteParamValue>

/**
 * Accepts both type aliases and interfaces while preserving Next's parameter
 * value constraint on every declared property.
 */
export type RouteParamsConstraint<T extends object> = object & { [K in keyof T]: RouteParamValue }

export interface RouteMeta {
    readonly method?: string
    readonly pathname?: string
    readonly runtime?: RouteRuntime
    readonly [key: string]: unknown
}

/** Metadata supplied to a Pipe for the value it is transforming. */
export interface ArgumentMetadata {
    readonly type: 'body' | 'query' | 'params' | 'headers' | 'custom'
    readonly name?: string
    readonly data?: string
    readonly fields?: Readonly<Record<string, ArgumentMetadata>>
}

/**
 * Framework-neutral request context used by the compiled pipeline.
 *
 * args is the adapter-owned resolved argument store. Route handlers in the
 * Next adapter receive these values as named context properties instead of
 * reading args directly.
 */
export interface RouteContext<
    TParams extends RouteParamsConstraint<TParams> = RouteParams,
    TArgs = Readonly<Record<string, unknown>>,
    TLocals = Record<string, never>,
> {
    request: Request
    params: TParams
    args: TArgs
    argumentMetadata?: ArgumentMetadata
    locals: TLocals
    meta: RouteMeta
}

export type AnyRouteContext = RouteContext<any, any, any>

export interface RouteConfig<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> {
    readonly plugins?: readonly RoutePlugin[]
    readonly middleware?: readonly RouteMiddleware<TContext>[]
    readonly guards?: readonly Guard<TContext>[]
    readonly pipes?: readonly Pipe<unknown, unknown, TContext>[]
    readonly interceptors?: readonly Interceptor<TContext>[]
    readonly exceptionFilters?: readonly ExceptionFilter<TContext>[]
    readonly responseSerializer?: ResponseSerializer<TResult, TContext>
}

export type RouteHandler<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> = (context: TContext) => MaybePromise<TResult>

export interface RouteOptions<TContext extends AnyRouteContext = AnyRouteContext, TResult = unknown> extends RouteConfig<TContext, TResult> {
    readonly handler: RouteHandler<TContext, TResult>
}

export interface RouteMiddleware<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    use(context: TContext, next: () => Promise<unknown>): MaybePromise<unknown>
}

export interface Guard<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    canActivate(context: TContext): MaybePromise<boolean | Response>
}

export interface Pipe<TInput = unknown, TOutput = TInput, TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    transform(value: TInput, metadata: ArgumentMetadata, context: TContext): MaybePromise<TOutput>
}

export interface Interceptor<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    intercept(context: TContext, next: () => Promise<unknown>): MaybePromise<unknown>
}

export interface ExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    catch(error: unknown, context: TContext): MaybePromise<Response | undefined>
}

export interface ResponseSerializer<TValue = unknown, TContext extends AnyRouteContext = AnyRouteContext> {
    readonly name: string

    serialize(value: TValue, context: TContext): MaybePromise<Response>
}

export interface RoutePluginContribution {
    readonly middleware?: readonly RouteMiddleware[]
    readonly guards?: readonly Guard[]
    readonly pipes?: readonly Pipe[]
    readonly interceptors?: readonly Interceptor[]
    readonly exceptionFilters?: readonly ExceptionFilter[]
    readonly responseSerializer?: ResponseSerializer
}

export interface RoutePlugin {
    readonly name: string
    readonly runtime?: RuntimeSupport

    install(): RoutePluginContribution
}
