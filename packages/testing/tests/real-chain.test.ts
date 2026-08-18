import { describe, expect, it } from 'vitest'
import {
    ApiException,
    apiResponsePlugin,
    createRoute,
    defineInputSource,
    HttpError,
    jsonBody,
    jsonResponse,
    query,
    unauthorized,
    type AnyRouteContext,
    type ExceptionFilter,
    type Guard,
    type Pipe,
    type Interceptor,
    type RouteMiddleware,
} from 'next-route-kit'
import { expectResponse, invokeRoute, RequestBuilder } from '../src/index.js'

type ResourceBody = {
    label: string
    size: number
}

type ResourceParams = {
    tenantId: string
}

type ResourceQuery = {
    preview?: string
}

type RequestLocals = {
    requestId: string
    startedAt: number
    userId?: string
}

type RequestContext = AnyRouteContext<RequestLocals>

describe('real user journey: authenticated resource creation', () => {
    it('solves repeated auth, request context, validation, response, and error concerns', async () => {
        const events: string[] = []
        const POST = createResourceRoute(events)<ResourceParams, ResourceBody, ResourceQuery>({
            body: defineInputSource('resource-body', 'body', async ({ readBody }) => {
                events.push('body-resolver')
                return readBody<ResourceBody>()
            }),
            query: query<ResourceQuery>(),
            handler: async (_request, { params, body, query: values, locals }) => {
                events.push('handler')

                return {
                    resourceId: 'resource-' + locals.userId + '-' + body.label,
                    tenantId: params.tenantId,
                    label: body.label,
                    size: body.size,
                    preview: values.preview ?? 'false',
                }
            },
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/tenants/tenant-demo/resources')
                .params({ tenantId: 'tenant-demo' })
                .query({ preview: 'true' })
                .header('authorization', 'Bearer sample-token')
                .header('x-request-id', 'request-demo')
                .json({ label: 'sample', size: 2 }),
        )

        const payload = await expectResponse(response).toBeOk().toHaveStatus(200).toHaveHeader('x-route-kit', 'real-chain').json<{
            data: {
                resourceId: string
                tenantId: string
                label: string
                size: number
                preview: string
            }
            meta: { requestId: string; userId: string; durationMs: number }
        }>()

        expect(payload.data).toEqual({
            resourceId: 'resource-viewer-demo-sample',
            tenantId: 'tenant-demo',
            label: 'sample',
            size: 2,
            preview: 'true',
        })
        expect(payload.meta).toMatchObject({
            requestId: 'request-demo',
            userId: 'viewer-demo',
        })
        expect(payload.meta.durationMs).toBeTypeOf('number')
        expect(events).toEqual(['middleware', 'guard', 'interceptor:before', 'body-resolver', 'pipe', 'handler', 'interceptor:after'])
    })

    it('rejects an unauthenticated request before reading a malformed body', async () => {
        const events: string[] = []
        const POST = createResourceRoute(events)({
            body: defineInputSource('resource-body', 'body', async ({ readBody }) => {
                events.push('body-resolver')
                return readBody<ResourceBody>()
            }),
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/tenants/tenant-demo/resources').header('x-request-id', 'request-anonymous').body('this is not JSON', 'application/json'),
        )

        await expectResponse(response).toHaveStatus(401).toHaveJson({
            code: 'UNAUTHORIZED',
            message: 'Authentication is required',
            requestId: 'request-anonymous',
        })

        expect(events).toEqual(['middleware', 'guard', 'exception-filter'])
    })

    it('returns a useful validation error after authentication but before the handler', async () => {
        const events: string[] = []
        const POST = createResourceRoute(events)({
            body: jsonBody<ResourceBody>(),
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await invokeRoute(
            POST,
            RequestBuilder.post('/api/tenants/tenant-demo/resources')
                .params({ tenantId: 'tenant-demo' })
                .header('authorization', 'Bearer sample-token')
                .header('x-request-id', 'req-invalid')
                .json({ label: '', size: 0 }),
        )

        await expectResponse(response)
            .toHaveStatus(422)
            .toHaveJson({
                code: 'INVALID_RESOURCE',
                message: 'label and size must be valid',
                details: { fields: ['body.label', 'body.size'] },
                requestId: 'req-invalid',
            })

        expect(events).toEqual(['middleware', 'guard', 'interceptor:before', 'pipe', 'exception-filter'])
    })

    it('keeps success, authentication, and business errors on one API contract', async () => {
        const ResponseCode = {
            SUCCESS: { code: 'OK', msg: 'Success' },
            QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', msg: 'Quota exceeded', status: 409 },
            INTERNAL_ERROR: { code: 'INTERNAL_ERROR', msg: 'Internal server error' },
        } as const

        const route = createRoute<RequestLocals>({
            middleware: [requestIdMiddleware([])],
            guards: [authenticationGuard([])],
            pipes: [resourceValidationPipe([])],
            plugins: [
                apiResponsePlugin({
                    success: ResponseCode.SUCCESS,
                    systemError: ResponseCode.INTERNAL_ERROR,
                }),
            ],
        })

        const POST = route({
            body: jsonBody<ResourceBody>(),
            handler: async (_request, { body, locals }) => {
                const available = 1

                if (body.size > available) {
                    throw new ApiException(ResponseCode.QUOTA_EXCEEDED, {
                        data: { requested: body.size, available },
                    })
                }

                return { resourceId: `resource-${locals.userId}-${body.label}` }
            },
        })

        const success = await invokeRoute(
            POST,
            RequestBuilder.post('/api/resources').header('authorization', 'Bearer sample-token').json({ label: 'sample', size: 1 }),
        )
        await expectResponse(success).toHaveJson({
            code: 'OK',
            msg: 'Success',
            data: { resourceId: 'resource-viewer-demo-sample' },
        })

        const businessError = await invokeRoute(
            POST,
            RequestBuilder.post('/api/resources').header('authorization', 'Bearer sample-token').json({ label: 'sample', size: 2 }),
        )
        await expectResponse(businessError)
            .toHaveStatus(409)
            .toHaveJson({
                code: 'QUOTA_EXCEEDED',
                msg: 'Quota exceeded',
                data: { requested: 2, available: 1 },
            })

        const unauthenticated = await invokeRoute(POST, RequestBuilder.post('/api/resources').json({ label: 'sample', size: 1 }))
        await expectResponse(unauthenticated).toHaveStatus(401).toHaveJson({
            code: 'UNAUTHORIZED',
            msg: 'Authentication is required',
            data: {},
        })
    })
})

function createResourceRoute(events: string[]) {
    const route = createRoute<RequestLocals>({
        middleware: [requestIdMiddleware(events)],
        interceptors: [responseEnvelopeInterceptor(events)],
        exceptionFilters: [requestExceptionFilter(events)],
        response: jsonResponse({
            headers: { 'x-route-kit': 'real-chain' },
        }),
    })

    return route.extend({
        guards: [authenticationGuard(events)],
        pipes: [resourceValidationPipe(events)],
    })
}

function requestIdMiddleware(events: string[]): RouteMiddleware<RequestContext> {
    return {
        name: 'request-id',
        use(context, next) {
            events.push('middleware')
            context.locals.requestId = context.request.headers.get('x-request-id') ?? 'req-generated'
            context.locals.startedAt = Date.now()
            return next()
        },
    }
}

function authenticationGuard(events: string[]): Guard<RequestContext> {
    return {
        name: 'authentication',
        canActivate(context) {
            events.push('guard')

            if (context.request.headers.get('authorization') !== 'Bearer sample-token') {
                throw unauthorized()
            }

            context.locals.userId = 'viewer-demo'
            return true
        },
    }
}

function resourceValidationPipe(events: string[]): Pipe<unknown, unknown, RequestContext> {
    return {
        name: 'resource-validation',
        transform(value, metadata) {
            if (metadata.type !== 'body') {
                return value
            }

            events.push('pipe')
            const body = value as Partial<ResourceBody>

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
}

function responseEnvelopeInterceptor(events: string[]): Interceptor<RequestContext> {
    return {
        name: 'response-envelope',
        async intercept(context, next) {
            events.push('interceptor:before')
            const value = await next()
            events.push('interceptor:after')

            if (value instanceof Response) {
                return value
            }

            return {
                data: value,
                meta: {
                    requestId: context.locals.requestId,
                    userId: context.locals.userId,
                    durationMs: Date.now() - context.locals.startedAt,
                },
            }
        },
    }
}

function requestExceptionFilter(events: string[]): ExceptionFilter<RequestContext> {
    return {
        name: 'request-exception-filter',
        catch(error, context) {
            events.push('exception-filter')

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
                    headers: { 'x-route-kit': 'real-chain' },
                },
            )
        },
    }
}
