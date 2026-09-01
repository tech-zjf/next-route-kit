import {
    createRoute,
    HttpError,
    jsonResponse,
    unauthorized,
    type AnyRouteContext,
    type ExceptionFilter,
    type Interceptor,
    type LocalsProvider,
    type Pipe,
} from 'next-route-kit'

export type RequestLocals = {
    requestId: string
    startedAt: number
}

export type AuthenticatedLocals = RequestLocals & {
    userId: string
}

type RequestContext = AnyRouteContext<RequestLocals>
type AuthenticatedContext = AnyRouteContext<AuthenticatedLocals>

const requestContextProvider: LocalsProvider<Record<string, never>, RequestLocals> = {
    name: 'request-context',
    provide(context) {
        return {
            requestId: context.request.headers.get('x-request-id') ?? 'fixture-generated-request',
            startedAt: Date.now(),
        }
    },
}

const responseEnvelopeInterceptor: Interceptor<RequestContext> = {
    name: 'response-envelope',
    async intercept(context, next) {
        const value = await next()

        if (value instanceof Response) {
            return value
        }

        return {
            data: value,
            meta: {
                requestId: context.locals.requestId,
                ...('userId' in context.locals ? { userId: context.locals.userId } : {}),
                durationMs: Date.now() - context.locals.startedAt,
            },
        }
    },
}

const requestExceptionFilter: ExceptionFilter<RequestContext> = {
    name: 'request-exception-filter',
    catch(error, context) {
        if (!(error instanceof HttpError)) {
            return undefined
        }

        return Response.json(
            {
                code: error.code,
                message: error.message,
                ...(error.details === undefined ? {} : { details: error.details }),
                requestId: context.locals.requestId,
            },
            {
                status: error.status,
                headers: { 'x-route-kit': 'fixture' },
            },
        )
    },
}

const authenticationProvider: LocalsProvider<RequestLocals, { userId: string }> = {
    name: 'authentication',
    provide(context) {
        if (context.request.headers.get('authorization') !== 'Bearer fixture-token') {
            throw unauthorized()
        }

        return { userId: 'viewer-fixture' }
    },
}

const resourceValidationPipe: Pipe<unknown, unknown, AuthenticatedContext> = {
    name: 'resource-validation',
    transform(value, metadata) {
        if (metadata.type !== 'body') {
            return value
        }

        const body = value as { label?: unknown; size?: unknown }

        if (typeof body.label !== 'string' || body.label.length === 0 || typeof body.size !== 'number' || body.size <= 0) {
            throw new HttpError({
                status: 422,
                code: 'INVALID_RESOURCE',
                message: 'label and size must be valid',
                details: { fields: ['body.label', 'body.size'] },
            })
        }

        return value
    },
}

export const route = createRoute()
    .withLocals(requestContextProvider)
    .extend({
        interceptors: [responseEnvelopeInterceptor],
        exceptionFilters: [requestExceptionFilter],
        response: jsonResponse({
            headers: { 'x-route-kit': 'fixture' },
        }),
    })

export const authenticatedRoute = route.withLocals(authenticationProvider)

export const resourceRoute = authenticatedRoute.extend({
    pipes: [resourceValidationPipe],
})
