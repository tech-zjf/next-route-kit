import { describe, expect, it } from 'vitest'
import {
    createRoute,
    HttpError,
    jsonBody,
    jsonResponse,
    params,
    query,
    unauthorized,
    type AnyRouteContext,
    type ErrorMapper,
    type Guard,
    type InputPipe,
    type Interceptor,
    type RouteMiddleware,
} from 'next-route-kit'
import { expectResponse, invokeRoute, RequestBuilder } from '../src/index.js'

type OrderBody = {
    sku: string
    quantity: number
}

type OrderParams = {
    accountId: string
}

type OrderInput = {
    account: OrderParams
    body: OrderBody
    query: Readonly<Record<string, string | readonly string[]>>
}

type RequestState = {
    requestId: string
    startedAt: number
    userId?: string
}

type RequestContext = AnyRouteContext<RequestState>

describe('real user journey: authenticated order creation', () => {
    it('solves the repeated cross-cutting concerns in one real request', async () => {
        const events: string[] = []
        const POST = createOrderRoute(events)({
            input: async ({ params: routeParams, readBody, request }) => {
                events.push('input-resolver')

                return {
                    account: routeParams,
                    body: await readBody<OrderBody>(),
                    query: Object.fromEntries(new URL(request.url).searchParams),
                }
            },
            handler: ({ input, state }) => {
                events.push('handler')

                return {
                    orderId: `order-${state.userId}-${input.body.sku}`,
                    accountId: input.account.accountId,
                    sku: input.body.sku,
                    quantity: input.body.quantity,
                    preview: input.query.preview ?? 'false',
                }
            },
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/accounts/acct-7/orders')
                .params({ accountId: 'acct-7' })
                .query({ preview: 'true' })
                .header('authorization', 'Bearer demo-token')
                .header('x-request-id', 'req-7')
                .json({ sku: 'sku-42', quantity: 2 }),
        )

        const payload = await expectResponse(response).toBeOk().toHaveStatus(200).toHaveHeader('x-route-kit', 'real-chain').json<{
            data: {
                orderId: string
                accountId: string
                sku: string
                quantity: number
                preview: string
            }
            meta: { requestId: string; userId: string; durationMs: number }
        }>()

        expect(payload.data).toEqual({
            orderId: 'order-user-42-sku-42',
            accountId: 'acct-7',
            sku: 'sku-42',
            quantity: 2,
            preview: 'true',
        })
        expect(payload.meta).toMatchObject({
            requestId: 'req-7',
            userId: 'user-42',
        })
        expect(payload.meta.durationMs).toBeTypeOf('number')
        expect(events).toEqual(['middleware', 'guard', 'input-resolver', 'pipe', 'interceptor:before', 'handler', 'interceptor:after'])
    })

    it('rejects an unauthenticated request before reading a malformed body', async () => {
        const events: string[] = []
        const POST = createOrderRoute(events)({
            input: async ({ readBody }) => {
                events.push('input-resolver')
                return { body: await readBody<OrderBody>() }
            },
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/accounts/acct-7/orders').header('x-request-id', 'req-anonymous').body('this is not JSON', 'application/json'),
        )

        await expectResponse(response).toHaveStatus(401).toHaveJson({
            code: 'UNAUTHORIZED',
            message: 'Authentication is required',
            requestId: 'req-anonymous',
        })

        expect(events).toEqual(['middleware', 'guard', 'error-mapper'])
    })

    it('returns a useful validation error after authentication but before the handler', async () => {
        const events: string[] = []
        const POST = createOrderRoute(events)({
            input: {
                account: params<OrderParams>(),
                body: jsonBody<OrderBody>(),
                query: query(),
            },
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/accounts/acct-7/orders')
                .params({ accountId: 'acct-7' })
                .header('authorization', 'Bearer demo-token')
                .header('x-request-id', 'req-invalid')
                .json({ sku: '', quantity: 0 }),
        )

        await expectResponse(response)
            .toHaveStatus(422)
            .toHaveJson({
                code: 'INVALID_ORDER',
                message: 'sku and quantity must be valid',
                details: { fields: ['body.sku', 'body.quantity'] },
                requestId: 'req-invalid',
            })

        expect(events).toEqual(['middleware', 'guard', 'pipe', 'error-mapper'])
    })
})

function createOrderRoute(events: string[]) {
    const route = createRoute<RequestState>({
        middleware: [requestIdMiddleware(events)],
        interceptors: [responseEnvelopeInterceptor(events)],
        errorMappers: [requestErrorMapper(events)],
        response: jsonResponse({
            headers: { 'x-route-kit': 'real-chain' },
        }),
    })

    return route.extend({
        guards: [authenticationGuard(events)],
        inputPipes: [orderValidationPipe(events)],
    })
}

function requestIdMiddleware(events: string[]): RouteMiddleware<RequestContext> {
    return {
        name: 'request-id',
        handle(context, next) {
            events.push('middleware')
            context.state.requestId = context.request.headers.get('x-request-id') ?? 'req-generated'
            context.state.startedAt = Date.now()
            return next()
        },
    }
}

function authenticationGuard(events: string[]): Guard<RequestContext> {
    return {
        name: 'authentication',
        canActivate(context) {
            events.push('guard')

            if (context.request.headers.get('authorization') !== 'Bearer demo-token') {
                throw unauthorized()
            }

            context.state.userId = 'user-42'
            return true
        },
    }
}

function orderValidationPipe(events: string[]): InputPipe<unknown, unknown, RequestContext> {
    return {
        name: 'order-validation',
        transform(value) {
            events.push('pipe')
            const input = value as Partial<OrderInput>
            const body = input.body as Partial<OrderBody> | undefined

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
}

function responseEnvelopeInterceptor(events: string[]): Interceptor<RequestContext> {
    return {
        name: 'response-envelope',
        async intercept(context, next) {
            events.push('interceptor:before')
            const value = await next()
            events.push('interceptor:after')

            return {
                data: value,
                meta: {
                    requestId: context.state.requestId,
                    userId: context.state.userId,
                    durationMs: Date.now() - context.state.startedAt,
                },
            }
        },
    }
}

function requestErrorMapper(events: string[]): ErrorMapper<RequestContext> {
    return {
        name: 'request-error',
        map(error, context) {
            events.push('error-mapper')

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
                    headers: { 'x-route-kit': 'real-chain' },
                },
            )
        },
    }
}
