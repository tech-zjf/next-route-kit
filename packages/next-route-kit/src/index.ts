export { createRoute, DEFAULT_MAX_BODY_BYTES, Factory, jsonResponse } from './factory.js'
export { defaultExceptionFilter, ApiException, DefaultExceptionFilter, InvalidJsonBodyError, PayloadTooLargeError } from './errors.js'
export { ApiExceptionFilter, ApiResponseInterceptor, ApiResponsePlugin, apiResponsePlugin } from './api-response.js'
export { InputSource, body, defineInputSource, jsonBody, query, textBody } from './input.js'
export type { InputSourceResolver, QueryInput, RouteInputDefinition, RouteInputLocation } from './input.js'
export type { ApiExceptionOptions, ResponseCodeDefinition } from './errors.js'
export type { ApiResponseData, ApiResponseEnvelope, ApiResponseErrorMapping, ApiResponsePluginOptions } from './api-response.js'
export type {
    AnyRouteContext,
    DefaultRouteLocals,
    JsonResponseOptions,
    LocalsProvider,
    NextRouteHandler,
    NextRouteHandlerContext,
    PublicRouteComponent,
    PublicRouteConfig,
    RouteFactory,
    RouteFactoryConfig,
    RouteHandler,
    RouteHandlerContext,
    RouteInputContext,
    RouteInputResolver,
    RouteOptions,
    RootRouteFactory,
} from './types.js'

export {
    DuplicateInterceptorNextError,
    DuplicateMiddlewareNextError,
    DuplicateResponseSerializerError,
    forbidden,
    HttpError,
    MissingResponseSerializerError,
    NativeResponseNotAllowedError,
    RuntimeIncompatiblePluginError,
    unauthorized,
} from '@next-route-kit/core'
export type {
    AnyRouteContext as CoreAnyRouteContext,
    ArgumentMetadata,
    ExceptionFilter,
    Guard,
    Interceptor,
    HttpErrorCode,
    MaybePromise,
    NativeResponsePolicy,
    Pipe,
    ResponseSerializer,
    RouteConfig,
    RouteContext,
    RouteHandler as CoreRouteHandler,
    RouteMeta,
    RouteMiddleware,
    RouteParamValue,
    RouteParams,
    RouteParamsConstraint,
    RoutePlugin,
    RoutePluginContribution,
    RouteRuntime,
    RuntimeSupport,
} from '@next-route-kit/core'
