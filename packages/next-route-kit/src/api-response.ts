import {
    HttpError,
    type AnyRouteContext,
    type ExceptionFilter,
    type HttpErrorCode,
    type Interceptor,
    type MaybePromise,
    type RoutePlugin,
    type RoutePluginContribution,
    type RuntimeSupport,
} from '@next-route-kit/core'
import { ApiException, type ResponseCodeDefinition } from './errors.js'

export type ApiResponseData = unknown

export interface ApiResponseEnvelope<TData = ApiResponseData, TCode extends HttpErrorCode = HttpErrorCode> {
    readonly code: TCode
    readonly msg: string
    readonly data: TData
}

/** A caller-supplied mapping for an error owned by an optional adapter. */
export interface ApiResponseErrorMapping<TCode extends HttpErrorCode = HttpErrorCode, TData = ApiResponseData> {
    readonly code: ResponseCodeDefinition<TCode>
    readonly status?: number
    readonly message?: string
    readonly data?: TData
}

export interface ApiResponsePluginOptions<
    TContext extends AnyRouteContext = AnyRouteContext,
    TCode extends HttpErrorCode = HttpErrorCode,
    TData = ApiResponseData,
> {
    /** The code emitted when a handler completes successfully. */
    readonly success: ResponseCodeDefinition<TCode>
    /** The code emitted when an unexpected error reaches the Route boundary. */
    readonly systemError: ResponseCodeDefinition<TCode>
    /** Map a handler result to the value stored in `data`. */
    readonly mapData?: (value: unknown, context: TContext) => MaybePromise<TData>
    /** Map structured exception details to the value stored in `data`. */
    readonly mapErrorData?: (error: unknown, context: TContext) => MaybePromise<TData>
    /** Map an application or optional-adapter error without coupling this package to it. */
    readonly mapError?: (error: unknown, context: TContext) => MaybePromise<ApiResponseErrorMapping<TCode, TData> | undefined>
    /** Report unexpected errors without exposing them to clients. Defaults to console.error when omitted. */
    readonly onUnknownError?: (error: unknown, context: TContext) => MaybePromise<void>
}

/** Intercepts successful handler values into the configured API envelope. */
export class ApiResponseInterceptor<
    TContext extends AnyRouteContext = AnyRouteContext,
    TCode extends HttpErrorCode = HttpErrorCode,
    TData = ApiResponseData,
> implements Interceptor<TContext> {
    readonly name = 'api-response'

    constructor(private readonly options: ApiResponsePluginOptions<TContext, TCode, TData>) {}

    async intercept(context: TContext, next: () => Promise<unknown>): Promise<unknown> {
        const value = await next()

        if (isResponse(value)) {
            return value
        }

        const data = this.options.mapData ? await this.options.mapData(value, context) : (value as TData)

        return {
            code: this.options.success.code,
            msg: this.options.success.msg,
            data,
        } satisfies ApiResponseEnvelope<TData, TCode>
    }
}

/** Converts ApiException, HttpError, and unknown errors to one API envelope. */
export class ApiExceptionFilter<
    TContext extends AnyRouteContext = AnyRouteContext,
    TCode extends HttpErrorCode = HttpErrorCode,
    TData = ApiResponseData,
> implements ExceptionFilter<TContext> {
    readonly name = 'api-exception'

    constructor(private readonly options: ApiResponsePluginOptions<TContext, TCode, TData>) {}

    async catch(error: unknown, context: TContext): Promise<Response> {
        const mappedError = await this.options.mapError?.(error, context)

        if (mappedError) {
            return Response.json(
                {
                    code: mappedError.code.code,
                    msg: mappedError.message ?? mappedError.code.msg,
                    data: mappedError.data === undefined ? {} : mappedError.data,
                } satisfies ApiResponseEnvelope<ApiResponseData, TCode>,
                { status: mappedError.status ?? mappedError.code.status ?? 400 },
            )
        }

        const knownError = error instanceof ApiException || error instanceof HttpError

        if (!knownError) {
            await this.reportUnknownError(error, context)
        }

        const code = knownError ? getErrorCode(error) : this.options.systemError
        const msg = knownError ? getErrorMessage(error) : this.options.systemError.msg
        const data = this.options.mapErrorData ? await this.options.mapErrorData(error, context) : knownError ? getErrorData(error) : {}

        return Response.json(
            {
                code: code.code,
                msg,
                data,
            } satisfies ApiResponseEnvelope<ApiResponseData, HttpErrorCode>,
            { status: knownError ? getErrorStatus(error) : 500 },
        )
    }

    private async reportUnknownError(error: unknown, context: TContext): Promise<void> {
        if (!this.options.onUnknownError) {
            reportUnknownErrorToConsole(error, context)
            return
        }

        try {
            await this.options.onUnknownError(error, context)
        } catch (reportingError) {
            reportUnknownErrorToConsole(error, context, reportingError)
        }
    }
}

/**
 * A plug-in for the common `{ code, msg, data }` API contract.
 *
 * It is deliberately opt-in: routes that stream, upload, redirect, or expose
 * another protocol can keep using native Request/Response handling.
 */
export class ApiResponsePlugin<
    TContext extends AnyRouteContext = AnyRouteContext,
    TCode extends HttpErrorCode = HttpErrorCode,
    TData = ApiResponseData,
> implements RoutePlugin {
    readonly name = 'api-response'
    readonly runtime: RuntimeSupport = 'both'

    constructor(private readonly options: ApiResponsePluginOptions<TContext, TCode, TData>) {}

    install(): RoutePluginContribution {
        return {
            interceptors: [new ApiResponseInterceptor(this.options) as Interceptor],
            exceptionFilters: [new ApiExceptionFilter(this.options) as ExceptionFilter],
        }
    }
}

export function apiResponsePlugin<TContext extends AnyRouteContext = AnyRouteContext, TCode extends HttpErrorCode = HttpErrorCode, TData = ApiResponseData>(
    options: ApiResponsePluginOptions<TContext, TCode, TData>,
): ApiResponsePlugin<TContext, TCode, TData> {
    return new ApiResponsePlugin(options)
}

function isResponse(value: unknown): value is Response {
    return typeof Response !== 'undefined' && value instanceof Response
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
    const data = error instanceof ApiException ? error.data : error.details
    return data === undefined ? {} : data
}

function getErrorStatus(error: ApiException | HttpError): number {
    return error.status
}

function reportUnknownErrorToConsole(error: unknown, context: AnyRouteContext, reportingError?: unknown): void {
    const route = {
        method: context.meta.method,
        pathname: context.meta.pathname,
    }

    if (reportingError === undefined) {
        console.error('[next-route-kit] Unhandled route error', route, error)
        return
    }

    console.error('[next-route-kit] Unknown-error reporter failed', route, { error, reportingError })
}
