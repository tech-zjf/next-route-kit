import {
    HttpError,
    type AnyRouteContext,
    type ExceptionFilter,
    type Interceptor,
    type MaybePromise,
    type RoutePlugin,
    type RoutePluginContribution,
    type RuntimeSupport,
} from '@next-route-kit/core'
import { ApiException, type ResponseCodeDefinition } from './errors.js'

export type ApiResponseData = Readonly<Record<string, unknown>>

export interface ApiResponseEnvelope<TData extends ApiResponseData = ApiResponseData> {
    readonly code: string
    readonly msg: string
    readonly data: TData
}

/** A caller-supplied mapping for an error owned by an optional adapter. */
export interface ApiResponseErrorMapping {
    readonly code: ResponseCodeDefinition
    readonly status?: number
    readonly message?: string
    readonly data?: ApiResponseData
}

export interface ApiResponsePluginOptions<TContext extends AnyRouteContext = AnyRouteContext> {
    /** The code emitted when a handler completes successfully. */
    readonly success: ResponseCodeDefinition
    /** The code emitted when an unexpected error reaches the Route boundary. */
    readonly systemError: ResponseCodeDefinition
    /** Map a handler result to the object stored in `data`. */
    readonly mapData?: (value: unknown, context: TContext) => MaybePromise<ApiResponseData>
    /** Map structured exception details to the object stored in `data`. */
    readonly mapErrorData?: (error: unknown, context: TContext) => MaybePromise<ApiResponseData>
    /** Map an application or optional-adapter error without coupling this package to it. */
    readonly mapError?: (error: unknown, context: TContext) => MaybePromise<ApiResponseErrorMapping | undefined>
    /** Log or report unexpected errors without exposing their internals to clients. */
    readonly onUnknownError?: (error: unknown, context: TContext) => MaybePromise<void>
}

/** Intercepts successful handler values into the configured API envelope. */
export class ApiResponseInterceptor<TContext extends AnyRouteContext = AnyRouteContext> implements Interceptor<TContext> {
    readonly name = 'api-response'

    constructor(private readonly options: ApiResponsePluginOptions<TContext>) {}

    async intercept(context: TContext, next: () => Promise<unknown>): Promise<unknown> {
        const value = await next()

        if (isResponse(value)) {
            return value
        }

        const mapped = this.options.mapData ? await this.options.mapData(value, context) : toApiResponseData(value)

        return {
            code: this.options.success.code,
            msg: this.options.success.msg,
            data: toApiResponseData(mapped),
        } satisfies ApiResponseEnvelope
    }
}

/** Converts ApiException, HttpError, and unknown errors to one API envelope. */
export class ApiExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext> implements ExceptionFilter<TContext> {
    readonly name = 'api-exception'

    constructor(private readonly options: ApiResponsePluginOptions<TContext>) {}

    async catch(error: unknown, context: TContext): Promise<Response> {
        const mappedError = await this.options.mapError?.(error, context)

        if (mappedError) {
            return Response.json(
                {
                    code: mappedError.code.code,
                    msg: mappedError.message ?? mappedError.code.msg,
                    data: toApiResponseData(mappedError.data),
                } satisfies ApiResponseEnvelope,
                { status: mappedError.status ?? mappedError.code.status ?? 400 },
            )
        }

        const knownError = error instanceof ApiException || error instanceof HttpError

        if (!knownError) {
            await this.options.onUnknownError?.(error, context)
        }

        const code = knownError ? getErrorCode(error) : this.options.systemError
        const msg = knownError ? getErrorMessage(error) : this.options.systemError.msg
        const data = this.options.mapErrorData ? await this.options.mapErrorData(error, context) : knownError ? getErrorData(error) : {}

        return Response.json(
            {
                code: code.code,
                msg,
                data: toApiResponseData(data),
            } satisfies ApiResponseEnvelope,
            { status: knownError ? getErrorStatus(error) : 500 },
        )
    }
}

/**
 * A plug-in for the common `{ code, msg, data }` API contract.
 *
 * It is deliberately opt-in: routes that stream, upload, redirect, or expose
 * another protocol can keep using native Request/Response handling.
 */
export class ApiResponsePlugin<TContext extends AnyRouteContext = AnyRouteContext> implements RoutePlugin {
    readonly name = 'api-response'
    readonly runtime: RuntimeSupport = 'both'

    constructor(private readonly options: ApiResponsePluginOptions<TContext>) {}

    install(): RoutePluginContribution {
        return {
            interceptors: [new ApiResponseInterceptor(this.options) as Interceptor],
            exceptionFilters: [new ApiExceptionFilter(this.options) as ExceptionFilter],
        }
    }
}

export function apiResponsePlugin<TContext extends AnyRouteContext = AnyRouteContext>(
    options: ApiResponsePluginOptions<TContext>,
): ApiResponsePlugin<TContext> {
    return new ApiResponsePlugin(options)
}

function isResponse(value: unknown): value is Response {
    return typeof Response !== 'undefined' && value instanceof Response
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toApiResponseData(value: unknown): ApiResponseData {
    if (value === undefined || value === null) {
        return {}
    }

    if (isRecord(value)) {
        return value
    }

    return { value }
}

function getErrorCode(error: ApiException | HttpError): ResponseCodeDefinition {
    if (error instanceof ApiException) {
        return error.responseCode
    }

    return { code: error.code, msg: error.message }
}

function getErrorMessage(error: ApiException | HttpError): string {
    return error.message
}

function getErrorData(error: ApiException | HttpError): ApiResponseData {
    return toApiResponseData(error instanceof ApiException ? error.data : error.details)
}

function getErrorStatus(error: ApiException | HttpError): number {
    return error.status
}
