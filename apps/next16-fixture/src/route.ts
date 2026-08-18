import {
    createRoute,
    HttpError,
    jsonResponse,
    unauthorized,
    type AnyRouteContext,
    type ExceptionFilter,
    type Guard,
    type Interceptor,
    type Pipe,
    type RouteMiddleware,
} from 'next-route-kit'

export type FixtureLocals = {
    requestId: string
    startedAt: number
    userId?: string
}

type FixtureContext = AnyRouteContext<FixtureLocals>

const requestIdMiddleware: RouteMiddleware<FixtureContext> = {
    name: 'request-id',
    use(context, next) {
        context.locals.requestId = context.request.headers.get('x-request-id') ?? 'fixture-generated-request'
        context.locals.startedAt = Date.now()
        return next()
    },
}

const responseEnvelopeInterceptor: Interceptor<FixtureContext> = {
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
                ...(context.locals.userId === undefined ? {} : { userId: context.locals.userId }),
                durationMs: Date.now() - context.locals.startedAt,
            },
        }
    },
}

const requestExceptionFilter: ExceptionFilter<FixtureContext> = {
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

const authenticationGuard: Guard<FixtureContext> = {
    name: 'authentication',
    canActivate(context) {
        if (context.request.headers.get('authorization') !== 'Bearer fixture-token') {
            throw unauthorized()
        }

        context.locals.userId = 'viewer-fixture'
        return true
    },
}

const resourceValidationPipe: Pipe<unknown, unknown, FixtureContext> = {
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

export const route = createRoute<FixtureLocals>({
    middleware: [requestIdMiddleware],
    interceptors: [responseEnvelopeInterceptor],
    exceptionFilters: [requestExceptionFilter],
    response: jsonResponse({
        headers: { 'x-route-kit': 'fixture' },
    }),
})

export const authenticatedRoute = route.extend({
    guards: [authenticationGuard],
})

export const resourceRoute = authenticatedRoute.extend({
    pipes: [resourceValidationPipe],
})
