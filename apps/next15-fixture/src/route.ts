import {
    createRoute,
    HttpError,
    jsonResponse,
    unauthorized,
    type AnyRouteContext,
    type ErrorMapper,
    type Guard,
    type InputPipe,
    type Interceptor,
    type RouteMiddleware,
} from 'next-route-kit'

export type FixtureState = {
    requestId: string
    startedAt: number
    userId?: string
}

type FixtureContext = AnyRouteContext<FixtureState>

const requestIdMiddleware: RouteMiddleware<FixtureContext> = {
    name: 'request-id',
    handle(context, next) {
        context.state.requestId = context.request.headers.get('x-request-id') ?? 'fixture-generated-request'
        context.state.startedAt = Date.now()
        return next()
    },
}

const responseEnvelopeInterceptor: Interceptor<FixtureContext> = {
    name: 'response-envelope',
    async intercept(context, next) {
        const value = await next()

        return {
            data: value,
            meta: {
                requestId: context.state.requestId,
                ...(context.state.userId === undefined ? {} : { userId: context.state.userId }),
                durationMs: Date.now() - context.state.startedAt,
            },
        }
    },
}

const requestErrorMapper: ErrorMapper<FixtureContext> = {
    name: 'request-error',
    map(error, context) {
        if (!(error instanceof HttpError)) {
            return undefined
        }

        return Response.json(
            {
                code: error.code,
                message: error.message,
                ...(error.details === undefined ? {} : { details: error.details }),
                requestId: context.state.requestId,
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

        context.state.userId = 'fixture-user'
        return true
    },
}

const orderValidationPipe: InputPipe<unknown, unknown, FixtureContext> = {
    name: 'order-validation',
    transform(value) {
        const input = value as { body?: { sku?: unknown; quantity?: unknown } }
        const body = input.body

        if (typeof body?.sku !== 'string' || body.sku.length === 0 || typeof body.quantity !== 'number' || body.quantity <= 0) {
            throw new HttpError({
                status: 422,
                code: 'INVALID_ORDER',
                message: 'sku and quantity must be valid',
                details: { fields: ['body.sku', 'body.quantity'] },
            })
        }

        return value
    },
}

export const route = createRoute<FixtureState>({
    middleware: [requestIdMiddleware],
    interceptors: [responseEnvelopeInterceptor],
    errorMappers: [requestErrorMapper],
    response: jsonResponse({
        headers: { 'x-route-kit': 'fixture' },
    }),
})

export const authenticatedRoute = route.extend({
    guards: [authenticationGuard],
})

export const orderRoute = authenticatedRoute.extend({
    inputPipes: [orderValidationPipe],
})
