import { HttpError, type AnyRouteContext, type ExceptionFilter, type HttpErrorCode } from '@next-route-kit/core'

/** An application-owned response code that is stable for clients to branch on. */
export interface ResponseCodeDefinition<TCode extends HttpErrorCode = HttpErrorCode> {
    readonly code: TCode
    readonly msg: string
    /** Optional transport status; business code and HTTP status remain separate. */
    readonly status?: number
}

export interface ApiExceptionOptions<TData = unknown> {
    readonly status?: number
    readonly message?: string
    readonly data?: TData
    readonly cause?: unknown
}

/**
 * Application error for a stable API code.
 *
 * Services can throw this without constructing a Response. The configured
 * API response plugin converts it into the application's `{ code, msg, data }`
 * contract at the Route boundary.
 */
export class ApiException<TCode extends HttpErrorCode = HttpErrorCode, TData = unknown> extends HttpError {
    readonly responseCode: ResponseCodeDefinition<TCode>
    readonly data: TData | undefined

    constructor(responseCode: ResponseCodeDefinition<TCode>, options: ApiExceptionOptions<TData> = {}) {
        super({
            status: options.status ?? responseCode.status ?? 400,
            code: responseCode.code,
            message: options.message ?? responseCode.msg,
            details: options.data,
            cause: options.cause,
        })

        this.name = 'ApiException'
        this.responseCode = responseCode
        this.data = options.data
    }
}

/** Raised when a route explicitly requests JSON but the body is malformed. */
export class InvalidJsonBodyError extends HttpError {
    constructor(cause?: unknown) {
        super({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON',
            cause,
        })
        this.name = 'InvalidJsonBodyError'
    }
}

/** Raised when an automatic body reader exceeds the configured byte limit. */
export class PayloadTooLargeError extends HttpError {
    readonly maxBytes: number

    constructor(maxBytes: number) {
        super({
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds the ${maxBytes}-byte limit`,
            details: { maxBytes },
        })
        this.name = 'PayloadTooLargeError'
        this.maxBytes = maxBytes
    }
}

/** Maps framework-known HTTP/input errors without exposing unexpected internals. */
export class DefaultExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext> implements ExceptionFilter<TContext> {
    readonly name = 'default-exception-filter'

    catch(error: unknown, _context: TContext): Response | undefined {
        if (!(error instanceof HttpError)) {
            return undefined
        }

        return Response.json(
            {
                code: error.code,
                message: error.message,
                ...(error.details === undefined ? {} : { details: error.details }),
            },
            { status: error.status },
        )
    }
}

export function defaultExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext>(): DefaultExceptionFilter<TContext> {
    return new DefaultExceptionFilter<TContext>()
}
