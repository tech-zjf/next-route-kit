import { HttpError, type AnyRouteContext, type ExceptionFilter } from '@next-route-kit/core'

/** An application-owned response code that is stable for clients to branch on. */
export interface ResponseCodeDefinition {
    readonly code: string
    readonly msg: string
    /** Optional transport status; business code and HTTP status remain separate. */
    readonly status?: number
}

export interface ApiExceptionOptions {
    readonly status?: number
    readonly message?: string
    readonly data?: Readonly<Record<string, unknown>>
    readonly cause?: unknown
}

/**
 * Application error for a stable API code.
 *
 * Services can throw this without constructing a Response. The configured
 * API response plugin converts it into the application's `{ code, msg, data }`
 * contract at the Route boundary.
 */
export class ApiException extends HttpError {
    readonly responseCode: ResponseCodeDefinition
    readonly data: Readonly<Record<string, unknown>>

    constructor(responseCode: ResponseCodeDefinition, options: ApiExceptionOptions = {}) {
        const data = Object.freeze({ ...(options.data ?? {}) })

        super({
            status: options.status ?? responseCode.status ?? 400,
            code: responseCode.code,
            message: options.message ?? responseCode.msg,
            details: data,
            cause: options.cause,
        })

        this.name = 'ApiException'
        this.responseCode = responseCode
        this.data = data
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
