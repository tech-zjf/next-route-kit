import { HttpError, type AnyRouteContext, type ErrorMapper } from '@next-route-kit/core'

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
export class DefaultErrorMapper<TContext extends AnyRouteContext = AnyRouteContext> implements ErrorMapper<TContext> {
    readonly name = 'default-error-mapper'

    map(error: unknown, _context: TContext): Response | undefined {
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

export function defaultErrorMapper<TContext extends AnyRouteContext = AnyRouteContext>(): DefaultErrorMapper<TContext> {
    return new DefaultErrorMapper<TContext>()
}
