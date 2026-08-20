import { describe, expect, it } from 'vitest'
import {
    createRoute,
    Factory,
    HttpError,
    jsonBody,
    jsonResponse,
    query,
    RuntimeIncompatiblePluginError,
    textBody,
    type ArgumentMetadata,
    type Pipe,
    type RoutePlugin,
} from '../src/index.js'

type AppLocals = {
    requestId: string
    userId?: string
}

interface DetailParams {
    id: string
}

interface InvalidDetailParams {
    id: number
}

type ResourceParams = {
    tenantId: string
}

type ResourceBody = {
    label: string
    size: number
}

type ResourceQuery = {
    preview?: string
}

function nextParams<TParams>(params: TParams): { params: Promise<TParams> } {
    return { params: Promise.resolve(params) }
}

describe('createRoute', () => {
    it('keeps Next-compatible values in custom route parameter types', () => {
        const route = createRoute()

        // @ts-expect-error Route params must use Next's string-based dynamic segment values.
        route<InvalidDetailParams>({
            handler: () => ({ ok: true }),
        })
    })

    it('keeps a detail route close to native Next and passes Request first', async () => {
        const route = createRoute<AppLocals>({
            middleware: [
                {
                    name: 'request-id',
                    use(context, next) {
                        context.locals.requestId = context.request.headers.get('x-request-id') ?? 'generated'
                        return next()
                    },
                },
            ],
        })

        expect(route).toBeInstanceOf(Factory)
        expect(Object.isFrozen(route)).toBe(true)

        const GET = route<DetailParams>({
            handler: async (request, { params, locals }) => ({
                method: request.method,
                id: params.id,
                requestId: locals.requestId,
            }),
        })

        const response = await GET(
            new Request('https://example.test/resources/sample-id', { headers: { 'x-request-id': 'request-sample' } }),
            nextParams({ id: 'sample-id' }),
        )

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            method: 'GET',
            id: 'sample-id',
            requestId: 'request-sample',
        })
    })

    it('isolates locals across concurrent requests', async () => {
        let releaseFirstRequest: (() => void) | undefined
        const firstRequestCanFinish = new Promise<void>((resolve) => {
            releaseFirstRequest = resolve
        })
        const route = createRoute<AppLocals>({
            middleware: [
                {
                    name: 'request-id',
                    use(context, next) {
                        context.locals.requestId = context.request.headers.get('x-request-id') ?? 'generated'
                        return next()
                    },
                },
            ],
        })
        const GET = route({
            async handler(_request, { locals }) {
                if (locals.requestId === 'request-first') {
                    await firstRequestCanFinish
                } else {
                    releaseFirstRequest?.()
                }

                return { requestId: locals.requestId }
            },
        })

        const [firstResponse, secondResponse] = await Promise.all([
            GET(new Request('https://example.test/resources/first', { headers: { 'x-request-id': 'request-first' } })),
            GET(new Request('https://example.test/resources/second', { headers: { 'x-request-id': 'request-second' } })),
        ])

        expect(await firstResponse.json()).toEqual({ requestId: 'request-first' })
        expect(await secondResponse.json()).toEqual({ requestId: 'request-second' })
    })

    it('resolves only declared body and query values into the handler context', async () => {
        const route = createRoute<AppLocals>({
            guards: [
                {
                    name: 'authentication',
                    canActivate(context) {
                        context.locals.userId = 'viewer-demo'
                        return true
                    },
                },
            ],
        })

        const POST = route<ResourceParams, ResourceBody, ResourceQuery>({
            body: jsonBody<ResourceBody>(),
            query: query<ResourceQuery>(),
            handler: async (request, { params, body, query, locals }) => ({
                tenantId: params.tenantId,
                userId: locals.userId,
                label: body.label,
                size: body.size,
                preview: query.preview === 'true',
                contentType: request.headers.get('content-type'),
            }),
        })

        const response = await POST(
            new Request('https://example.test/tenants/tenant-demo/resources?preview=true', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: 'sample', size: 2 }),
            }),
            nextParams({ tenantId: 'tenant-demo' }),
        )

        expect(await response.json()).toEqual({
            tenantId: 'tenant-demo',
            userId: 'viewer-demo',
            label: 'sample',
            size: 2,
            preview: true,
            contentType: 'application/json',
        })
    })

    it('keeps the request body unread when a guard rejects the request', async () => {
        let bodyRead = false
        const route = createRoute({
            guards: [
                {
                    name: 'reject',
                    canActivate: () => {
                        return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401, headers: { 'content-type': 'application/json' } })
                    },
                },
            ],
        })

        const POST = route({
            body: async ({ readBody }) => {
                bodyRead = true
                return readBody()
            },
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await POST(
            new Request('https://example.test/resources', {
                method: 'POST',
                body: 'not-json',
            }),
        )

        expect(response.status).toBe(401)
        expect(bodyRead).toBe(false)
    })

    it('does not run global pipes when a route declares no input', async () => {
        let pipeRuns = 0
        const route = createRoute({
            pipes: [
                {
                    name: 'input-only-pipe',
                    transform(value) {
                        pipeRuns += 1
                        return value
                    },
                },
            ],
        })

        const GET = route({
            handler: () => ({ ok: true }),
        })

        const response = await GET(new Request('https://example.test/health'))

        expect(pipeRuns).toBe(0)
        expect(await response.json()).toEqual({ ok: true })
    })

    it('runs middleware, guard, interceptor, body pipe, handler, and unwind stages in order', async () => {
        const events: string[] = []
        const route = createRoute<AppLocals>({
            middleware: [
                {
                    name: 'middleware',
                    async use(_context, next) {
                        events.push('middleware:before')
                        const result = await next()
                        events.push('middleware:after')
                        return result
                    },
                },
            ],
            guards: [
                {
                    name: 'guard',
                    canActivate() {
                        events.push('guard')
                        return true
                    },
                },
            ],
            interceptors: [
                {
                    name: 'interceptor',
                    async intercept(_context, next) {
                        events.push('interceptor:before')
                        const result = await next()
                        events.push('interceptor:after')
                        return result
                    },
                },
            ],
        })

        const POST = route({
            body: jsonBody<ResourceBody>(),
            pipes: [
                {
                    name: 'body-pipe',
                    transform(value, metadata) {
                        events.push('pipe:' + metadata.type)
                        const body = value as ResourceBody
                        return { ...body, size: body.size + 1 }
                    },
                },
            ],
            handler: (_request, { body }) => {
                events.push('handler')
                return body
            },
        })

        const response = await POST(
            new Request('https://example.test/resources', {
                method: 'POST',
                body: JSON.stringify({ label: 'sample', size: 2 }),
            }),
        )

        expect(events).toEqual(['middleware:before', 'guard', 'interceptor:before', 'pipe:body', 'handler', 'interceptor:after', 'middleware:after'])
        expect(await response.json()).toEqual({ label: 'sample', size: 3 })
    })

    it('uses raw URL search params when query parsing is not needed', async () => {
        const GET = createRoute()({
            handler: (request, { params }) => ({
                id: params.id,
                search: new URL(request.url).searchParams.get('search'),
            }),
        })

        const response = await GET(new Request('https://example.test/resources/sample-id?search=route-kit'), nextParams({ id: 'sample-id' }))

        expect(await response.json()).toEqual({ id: 'sample-id', search: 'route-kit' })
    })

    it('parses repeated query keys only when query is declared', async () => {
        const GET = createRoute()({
            query: query(),
            handler: (_request, { query: values }) => values,
        })

        const response = await GET(new Request('https://example.test/resources?tag=a&tag=b'))

        expect(await response.json()).toEqual({ tag: ['a', 'b'] })
    })

    it('supports textBody without changing the native handler signature', async () => {
        const POST = createRoute()({
            body: textBody(),
            handler: (_request, { body }) => ({ value: body }),
        })

        const response = await POST(new Request('https://example.test/webhook', { method: 'POST', body: 'signed-payload' }))

        expect(await response.json()).toEqual({ value: 'signed-payload' })
    })

    it('maps malformed JSON through the default exception filter', async () => {
        const POST = createRoute()({
            body: jsonBody<{ ok: boolean }>(),
            handler: () => ({ ok: true }),
        })

        const response = await POST(new Request('https://example.test/json', { method: 'POST', body: 'invalid' }))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON',
        })
    })

    it('lets an exception filter use locals created by middleware', async () => {
        const route = createRoute<AppLocals>({
            middleware: [
                {
                    name: 'request-id',
                    use(context, next) {
                        context.locals.requestId = 'req-filter'
                        return next()
                    },
                },
            ],
            exceptionFilters: [
                {
                    name: 'filter',
                    catch(error, context) {
                        if (error instanceof HttpError) {
                            return Response.json({ code: error.code, requestId: context.locals.requestId }, { status: error.status })
                        }

                        return undefined
                    },
                },
            ],
        })

        const GET = route({
            handler: () => {
                throw new HttpError({ status: 422, code: 'INVALID_RESOURCE', message: 'invalid resource' })
            },
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({ code: 'INVALID_RESOURCE', requestId: 'req-filter' })
    })

    it('keeps Factory scopes immutable and composes extend configuration', async () => {
        const root = createRoute<AppLocals>({
            middleware: [
                {
                    name: 'root-middleware',
                    use(_context, next) {
                        return next()
                    },
                },
            ],
        })
        const child = root.extend({
            guards: [
                {
                    name: 'child-guard',
                    canActivate: () => true,
                },
            ],
        })

        expect(root.config.middleware).toHaveLength(1)
        expect(root.config.guards).toHaveLength(0)
        expect(child.config.middleware).toHaveLength(1)
        expect(child.config.guards).toHaveLength(1)
        expect(Object.isFrozen(root.config.middleware)).toBe(true)

        const GET = child({
            handler: () => ({ ok: true }),
        })

        expect(await (await GET(new Request('https://example.test'))).json()).toEqual({ ok: true })
    })

    it('installs custom plugin contributions and rejects incompatible runtime targets before serving requests', async () => {
        const events: string[] = []
        const plugin: RoutePlugin = {
            name: 'request-policy',
            runtime: 'nodejs' as const,
            install() {
                return {
                    middleware: [
                        {
                            name: 'plugin-middleware',
                            async use(_context, next) {
                                events.push('middleware:before')
                                const result = await next()
                                events.push('middleware:after')
                                return result
                            },
                        },
                    ],
                    interceptors: [
                        {
                            name: 'plugin-interceptor',
                            async intercept(_context, next) {
                                events.push('interceptor:before')
                                const result = await next()
                                events.push('interceptor:after')
                                return result
                            },
                        },
                    ],
                }
            },
        }

        const route = createRoute({ runtime: 'nodejs', plugins: [plugin] })
        const GET = route({
            handler: () => {
                events.push('handler')
                return { ok: true }
            },
        })

        const response = await GET(new Request('https://example.test/plugins'))

        expect(await response.json()).toEqual({ ok: true })
        expect(events).toEqual(['middleware:before', 'interceptor:before', 'handler', 'interceptor:after', 'middleware:after'])
        expect(() => createRoute({ runtime: 'edge', plugins: [plugin] })).toThrow(RuntimeIncompatiblePluginError)
    })

    it('passes through a native Response returned by the handler', async () => {
        const GET = createRoute()({
            handler: () => new Response('accepted', { status: 202 }),
        })

        const response = await GET(new Request('https://example.test'))

        expect(response.status).toBe(202)
        expect(await response.text()).toBe('accepted')
    })

    it('exposes argument metadata to custom pipes', async () => {
        let metadata: ArgumentMetadata | undefined
        const pipe: Pipe = {
            name: 'metadata',
            transform(value, currentMetadata) {
                metadata = currentMetadata
                return value
            },
        }
        const GET = createRoute()({
            query: query(),
            pipes: [pipe],
            handler: (_request, { query: values }) => values,
        })

        await GET(new Request('https://example.test?mode=full'))

        expect(metadata).toEqual({
            type: 'query',
            name: 'query',
        })
    })

    it('keeps body metadata for custom body resolvers', async () => {
        let metadata: ArgumentMetadata | undefined
        const route = createRoute({
            pipes: [
                {
                    name: 'body-only',
                    transform(value, currentMetadata) {
                        metadata = currentMetadata
                        expect(currentMetadata.type).toBe('body')
                        return value
                    },
                },
            ],
        })
        const POST = route<ResourceParams, ResourceBody>({
            body: async ({ readBody }) => readBody<ResourceBody>(),
            handler: (_request, { body }) => body,
        })

        const response = await POST(
            new Request('https://example.test/resources', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: 'sample', size: 2 }),
            }),
            nextParams({ tenantId: 'tenant-demo' }),
        )

        expect(metadata).toEqual({
            type: 'body',
            name: 'body',
        })
        expect(await response.json()).toEqual({ label: 'sample', size: 2 })
    })

    it('preserves a native Response through a response-aware interceptor', async () => {
        const GET = createRoute({
            interceptors: [
                {
                    name: 'response-envelope',
                    async intercept(_context, next) {
                        const value = await next()

                        if (value instanceof Response) {
                            return value
                        }

                        return { data: value }
                    },
                },
            ],
        })({
            handler: () => new Response('accepted', { status: 202, headers: { 'x-custom': 'kept' } }),
        })

        const response = await GET(new Request('https://example.test'))

        expect(response.status).toBe(202)
        expect(response.headers.get('x-custom')).toBe('kept')
        expect(await response.text()).toBe('accepted')
    })

    it('uses a route response serializer for plain values', async () => {
        const GET = createRoute()({
            response: jsonResponse({ status: 201, headers: { 'x-route': 'kit' } }),
            handler: () => ({ created: true }),
        })

        const response = await GET(new Request('https://example.test'))

        expect(response.status).toBe(201)
        expect(response.headers.get('x-route')).toBe('kit')
        expect(await response.json()).toEqual({ created: true })
    })
})
