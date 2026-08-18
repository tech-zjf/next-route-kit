export { createRoute, Factory, jsonResponse } from './factory.js'
export { InputSource, body, defineInputSource, headers, jsonBody, params, query, textBody } from './input.js'
export type { InputSourceResolver, QueryInput, ResolvedRouteInput, RouteInputDefinition, RouteInputSourceMap } from './input.js'
export type {
    AnyRouteContext,
    DefaultRouteState,
    JsonResponseOptions,
    NextRouteHandler,
    NextRouteHandlerContext,
    PublicRouteComponent,
    PublicRouteConfig,
    RouteFactory,
    RouteFactoryConfig,
    RouteInputContext,
    RouteInputResolver,
    RouteOptions,
    RootRouteFactory,
} from './types.js'

export {
    DuplicateMiddlewareNextError,
    DuplicateResponseSerializerError,
    forbidden,
    HttpError,
    MissingResponseSerializerError,
    unauthorized,
} from '@next-route-kit/core'
export type {
    AnyRouteContext as CoreAnyRouteContext,
    ErrorMapper,
    Guard,
    InputMetadata,
    InputPipe,
    Interceptor,
    MaybePromise,
    ResponseSerializer,
    RouteConfig,
    RouteContext,
    RouteHandler,
    RouteMeta,
    RouteMiddleware,
    RouteParams,
    RoutePlugin,
    RoutePluginContribution,
    RouteRuntime,
    RuntimeSupport,
} from '@next-route-kit/core'
