import type {
    ExceptionFilter,
    Guard,
    Interceptor,
    MaybePromise,
    Pipe,
    ResponseSerializer,
    RouteConfig,
    RouteContext,
    RouteMeta,
    RouteMiddleware,
    RouteParams,
    RouteParamsConstraint,
    RoutePlugin,
    RouteRuntime,
} from '@next-route-kit/core'
import type { RouteInputDefinition } from './input.js'

export type DefaultRouteLocals = Record<string, never>

export type AnyRouteContext<TLocals = DefaultRouteLocals> = RouteContext<any, Record<string, unknown>, TLocals>

export interface NextRouteHandlerContext<TParams extends RouteParamsConstraint<TParams> = RouteParams> {
    readonly params: Promise<TParams>
}

export interface NextRouteHandler<TParams extends RouteParamsConstraint<TParams> = RouteParams> {
    (request: Request): MaybePromise<Response>
    (request: Request, context: NextRouteHandlerContext<TParams>): MaybePromise<Response>
}

interface BaseRouteHandlerContext<TParams extends RouteParamsConstraint<TParams>, TLocals> {
    readonly params: TParams
    readonly locals: TLocals
    readonly meta: RouteMeta
}

type OptionalRouteValue<TValue, TKey extends string> = [TValue] extends [never] ? {} : { readonly [Key in TKey]: TValue }

export type RouteHandlerContext<
    TParams extends RouteParamsConstraint<TParams> = RouteParams,
    TBody = never,
    TQuery = never,
    TLocals = DefaultRouteLocals,
> = BaseRouteHandlerContext<TParams, TLocals> & OptionalRouteValue<TBody, 'body'> & OptionalRouteValue<TQuery, 'query'>

export type RouteHandler<
    TParams extends RouteParamsConstraint<TParams> = RouteParams,
    TBody = never,
    TQuery = never,
    TLocals = DefaultRouteLocals,
    TResult = unknown,
> = (request: Request, context: RouteHandlerContext<TParams, TBody, TQuery, TLocals>) => MaybePromise<TResult>

export interface RouteInputContext<TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals> {
    readonly request: Request
    readonly params: TParams
    readonly locals: TLocals
    /** Lazily parses JSON and reuses the same parsed value on later calls. */
    readonly readBody: <T = unknown>() => Promise<T>
    /** Lazily reads text while sharing the underlying one-shot Request stream. */
    readonly readText: () => Promise<string>
}

export type RouteInputResolver<TParams extends RouteParamsConstraint<TParams> = RouteParams, TValue = unknown, TLocals = DefaultRouteLocals> = (
    context: RouteInputContext<TParams, TLocals>,
) => MaybePromise<TValue>

export interface RouteFactoryConfig<TLocals = DefaultRouteLocals> extends RouteConfig<AnyRouteContext<TLocals>, unknown> {
    /** Runtime target used for static plugin compatibility diagnostics. */
    readonly runtime?: RouteRuntime
    /** User-facing alias for responseSerializer. */
    readonly response?: ResponseSerializer<unknown, AnyRouteContext<TLocals>>
}

export interface RouteOptions<
    TParams extends RouteParamsConstraint<TParams> = RouteParams,
    TBody = never,
    TQuery = never,
    TLocals = DefaultRouteLocals,
    TResult = unknown,
> extends RouteConfig<AnyRouteContext<TLocals>, TResult> {
    /** Route-level runtime target used for static plugin compatibility diagnostics. */
    readonly runtime?: RouteRuntime
    /** Optional automatic body parsing. Omit it to keep the native Request body API. */
    readonly body?: RouteInputDefinition<TBody, TParams, TLocals>
    /** Optional query parsing. Omit it to read request.url directly. */
    readonly query?: RouteInputDefinition<TQuery, TParams, TLocals>
    /** User-facing alias for a route-local responseSerializer. */
    readonly response?: ResponseSerializer<unknown, AnyRouteContext<TLocals>>
    /** Route-local plugins; use is kept as the concise route-level spelling. */
    readonly use?: readonly RoutePlugin[]
    readonly handler: RouteHandler<TParams, TBody, TQuery, TLocals, TResult>
}

export interface RouteFactory<TLocals = DefaultRouteLocals> {
    readonly config: Readonly<RouteFactoryConfig<TLocals>>

    <TParams extends RouteParamsConstraint<TParams> = RouteParams, TBody = never, TQuery = never, TResult = unknown>(
        options: RouteOptions<TParams, TBody, TQuery, TLocals, TResult>,
    ): NextRouteHandler<TParams>

    extend(config: RouteFactoryConfig<TLocals>): RouteFactory<TLocals>
}

export interface RootRouteFactory {
    <TLocals = DefaultRouteLocals>(config?: RouteFactoryConfig<TLocals>): RouteFactory<TLocals>
}

export interface JsonResponseOptions<TContext extends RouteContext<any, any, any> = RouteContext<any, any, any>> {
    readonly status?: number
    readonly headers?: HeadersInit
    readonly transform?: (value: unknown, context: TContext) => MaybePromise<unknown>
}

export type PublicRouteConfig<TLocals = DefaultRouteLocals> = RouteFactoryConfig<TLocals>

export type PublicRouteComponent<TLocals = DefaultRouteLocals> =
    | RouteMiddleware<AnyRouteContext<TLocals>>
    | Guard<AnyRouteContext<TLocals>>
    | Pipe<unknown, unknown, AnyRouteContext<TLocals>>
    | Interceptor<AnyRouteContext<TLocals>>
    | ExceptionFilter<AnyRouteContext<TLocals>>
