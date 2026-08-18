import { describe, expect, it } from 'vitest'
import { createRoute, Factory, headers, jsonBody, params, query, RuntimeIncompatiblePluginError, textBody } from '../src/index.js'

describe('createRoute', () => {
    it('exposes source metadata for composed input maps', async () => {
        let receivedMetadata: unknown
        const route = createRoute({
            inputPipes: [
                {
                    name: 'metadata-observer',
                    transform(value, metadata) {
                        receivedMetadata = metadata
                        return value
                    },
                },
            ],
        })
        const POST = route({
            input: {
                payload: jsonBody<{ ok: boolean }>(),
                filter: query(),
                staticValue: 'fixed',
            },
            handler: ({ input }) => input,
        })

        const response = await POST(
            new Request('https://example.test/input?filter=active', {
                method: 'POST',
                body: JSON.stringify({ ok: true }),
            }),
        )
        const metadata = receivedMetadata as {
            location: string
            name?: string
            fields?: Record<string, { location: string; name?: string }>
        }

        expect(metadata).toEqual({
            location: 'custom',
            name: 'route-input',
            fields: {
                payload: { location: 'body', name: 'json-body' },
                filter: { location: 'query', name: 'query' },
                staticValue: { location: 'custom', name: 'staticValue' },
            },
        })
        expect(Object.isFrozen(metadata)).toBe(true)
        expect(Object.isFrozen(metadata.fields)).toBe(true)
        expect(await response.json()).toEqual({
            payload: { ok: true },
            filter: { filter: 'active' },
            staticValue: 'fixed',
        })
    })

    it('creates a native-compatible handler with global configuration', async () => {
        const events: string[] = []
        const route = createRoute({
            middleware: [
                {
                    name: 'global-middleware',
                    async handle(_context, next) {
                        events.push('before')
                        const result = await next()
                        events.push('after')
                        return result
                    },
                },
            ],
        })

        expect(route).toBeInstanceOf(Factory)
        expect(Object.isFrozen(route)).toBe(true)
        expect(Reflect.set(route, 'unexpected', true)).toBe(false)
        expect(route.config.middleware).toHaveLength(1)

        const GET = route({
            handler: ({ params }) => {
                events.push(params.id as string)
                return { ok: true }
            },
        })

        const response = await GET(new Request('https://example.test/users/42'), {
            params: Promise.resolve({ id: '42' }),
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(events).toEqual(['before', '42', 'after'])
    })

    it('runs middleware and guards before input resolution, then pipes before interceptors', async () => {
        const events: string[] = []
        const route = createRoute({
            middleware: [
                {
                    name: 'middleware',
                    handle(_context, next) {
                        events.push('middleware')
                        return next()
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
            inputPipes: [
                {
                    name: 'pipe',
                    transform(value) {
                        events.push('pipe')
                        return value
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
        const GET = route({
            input: () => {
                events.push('input')
                return { ok: true }
            },
            handler: () => {
                events.push('handler')
                return { ok: true }
            },
        })

        const response = await GET(new Request('https://example.test/lifecycle'))

        expect(events).toEqual(['middleware', 'guard', 'input', 'pipe', 'interceptor:before', 'handler', 'interceptor:after'])
        expect(await response.json()).toEqual({ ok: true })
    })

    it('does not resolve input when a guard denies the request', async () => {
        let inputCalls = 0
        const POST = createRoute({
            guards: [
                {
                    name: 'deny',
                    canActivate: () => false,
                },
            ],
        })({
            input: () => {
                inputCalls += 1
                return { ok: true }
            },
            handler: () => ({ ok: true }),
        })

        const response = await POST(new Request('https://example.test/guarded', { method: 'POST' }))

        expect(response.status).toBe(403)
        expect(inputCalls).toBe(0)
    })

    it('hydrates Next params before middleware and guards', async () => {
        const events: string[] = []
        const GET = createRoute({
            middleware: [
                {
                    name: 'params-middleware',
                    handle(context, next) {
                        events.push(`middleware:${context.params.id}`)
                        return next()
                    },
                },
            ],
            guards: [
                {
                    name: 'params-guard',
                    canActivate(context) {
                        events.push(`guard:${context.params.id}`)
                        return true
                    },
                },
            ],
        })({
            input: ({ params: routeParams }) => {
                events.push(`input:${routeParams.id}`)
                return routeParams
            },
            handler: ({ input }) => ({ id: input.id }),
        })

        const response = await GET(new Request('https://example.test/users/42'), {
            params: Promise.resolve({ id: '42' }),
        })

        expect(events).toEqual(['middleware:42', 'guard:42', 'input:42'])
        expect(await response.json()).toEqual({ id: '42' })
    })

    it('supports optional catch-all params in input sources', async () => {
        const GET = createRoute()({
            input: params<{ slug: string[] | undefined }>(),
            handler: ({ input }) => ({ hasSlug: input.slug !== undefined }),
        })

        const response = await GET(new Request('https://example.test/docs'), {
            params: Promise.resolve({ slug: undefined }),
        })

        expect(await response.json()).toEqual({ hasSlug: false })
    })

    it('maps malformed JSON bodies to a bad request response by default', async () => {
        const POST = createRoute()({
            input: jsonBody(),
            handler: () => ({ ok: true }),
        })

        const response = await POST(
            new Request('https://example.test/malformed-json', {
                method: 'POST',
                body: 'not-json',
            }),
        )

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON',
        })
    })

    it('fails early with a clear diagnostic for an incompatible global plugin', () => {
        expect(() =>
            createRoute({
                runtime: 'edge',
                plugins: [
                    {
                        name: 'node-database',
                        runtime: 'nodejs',
                        install() {
                            return {}
                        },
                    },
                ],
            }),
        ).toThrow(RuntimeIncompatiblePluginError)

        expect(() =>
            createRoute({
                runtime: 'edge',
                plugins: [
                    {
                        name: 'node-database',
                        runtime: 'nodejs',
                        install() {
                            return {}
                        },
                    },
                ],
            }),
        ).toThrow('Use a compatible plugin or create a separate Factory')
    })

    it('validates inherited plugins when a scope selects a runtime', () => {
        const route = createRoute({
            plugins: [
                {
                    name: 'node-database',
                    runtime: 'nodejs',
                    install() {
                        return {}
                    },
                },
            ],
        })

        expect(() => route.extend({ runtime: 'edge' })).toThrow('node-database')
    })

    it('exposes the configured runtime in route metadata', async () => {
        const route = createRoute({ runtime: 'edge' })
        const GET = route({ handler: ({ meta }) => ({ runtime: meta.runtime }) })

        const response = await GET(new Request('https://example.test/runtime'))

        expect(await response.json()).toEqual({ runtime: 'edge' })
    })

    it('keeps factories immutable and applies scope configuration through extend', async () => {
        const global = createRoute({
            guards: [
                {
                    name: 'global-guard',
                    canActivate() {
                        return true
                    },
                },
            ],
        })
        const scoped = global.extend({
            middleware: [
                {
                    name: 'scope-middleware',
                    async handle(_context, next) {
                        return { scope: await next() }
                    },
                },
            ],
        })

        const baseResponse = await global({ handler: () => ({ base: true }) })(new Request('https://example.test/base'))
        const scopedResponse = await scoped({ handler: () => ({ scoped: true }) })(new Request('https://example.test/scoped'))

        expect(await baseResponse.json()).toEqual({ base: true })
        expect(await scopedResponse.json()).toEqual({
            scope: { scoped: true },
        })
    })

    it('resolves function input exactly once before the pipeline runs', async () => {
        let inputCalls = 0
        const route = createRoute()
        const POST = route({
            input: async ({ request }) => {
                inputCalls += 1
                return request.headers.get('x-value')
            },
            handler: ({ input }) => ({ input }),
        })

        const response = await POST(
            new Request('https://example.test/input', {
                headers: { 'x-value': 'parsed' },
            }),
        )

        expect(inputCalls).toBe(1)
        expect(await response.json()).toEqual({ input: 'parsed' })
    })

    it('maps input resolver errors through the configured error mappers', async () => {
        const route = createRoute({
            errorMappers: [
                {
                    name: 'input-error',
                    map(error) {
                        if (error instanceof Error && error.message === 'bad input') {
                            return Response.json({ code: 'BAD_INPUT' }, { status: 422 })
                        }

                        return undefined
                    },
                },
            ],
        })
        const POST = route({
            input: () => {
                throw new Error('bad input')
            },
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await POST(new Request('https://example.test/input-error'))

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({ code: 'BAD_INPUT' })
    })

    it('maps params resolution errors through the configured error mappers', async () => {
        const route = createRoute({
            errorMappers: [
                {
                    name: 'params-error',
                    map(error) {
                        if (error instanceof Error && error.message === 'bad params') {
                            return Response.json({ code: 'BAD_PARAMS' }, { status: 400 })
                        }

                        return undefined
                    },
                },
            ],
        })
        const GET = route({
            handler: () => ({ shouldNotRun: true }),
        })

        const response = await GET(new Request('https://example.test/params-error'), {
            params: Promise.reject(new Error('bad params')),
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ code: 'BAD_PARAMS' })
    })

    it('caches one-shot request body reads inside the input resolver', async () => {
        const route = createRoute()
        const POST = route({
            input: async ({ readBody }) => {
                const first = await readBody<{ value: string }>()
                const second = await readBody<{ value: string }>()
                return { first, second }
            },
            handler: ({ input }) => input,
        })

        const response = await POST(
            new Request('https://example.test/body', {
                method: 'POST',
                body: JSON.stringify({ value: 'cached' }),
                headers: { 'content-type': 'application/json' },
            }),
        )

        expect(await response.json()).toEqual({
            first: { value: 'cached' },
            second: { value: 'cached' },
        })
    })

    it('installs global plugins when the Factory is created, not per request', async () => {
        let installCount = 0
        const route = createRoute({
            plugins: [
                {
                    name: 'once',
                    install() {
                        installCount += 1
                        return {}
                    },
                },
            ],
        })

        expect(installCount).toBe(1)
        const GET = route({ handler: () => ({ ok: true }) })

        await GET(new Request('https://example.test/one'))
        await GET(new Request('https://example.test/two'))

        expect(installCount).toBe(1)
    })

    it('installs route-local use plugins when the handler is compiled', async () => {
        let installCount = 0
        const events: string[] = []
        const route = createRoute()
        const GET = route({
            use: [
                {
                    name: 'route-use',
                    install() {
                        installCount += 1
                        return {
                            middleware: [
                                {
                                    name: 'route-use-middleware',
                                    handle(_context, next) {
                                        events.push('before')
                                        return next().then((result) => {
                                            events.push('after')
                                            return result
                                        })
                                    },
                                },
                            ],
                        }
                    },
                },
            ],
            handler: () => ({ ok: true }),
        })

        expect(installCount).toBe(1)
        await GET(new Request('https://example.test/route-use'))
        await GET(new Request('https://example.test/route-use-again'))

        expect(installCount).toBe(1)
        expect(events).toEqual(['before', 'after', 'before', 'after'])
    })

    it('passes through a Response returned by the handler', async () => {
        const route = createRoute()
        const response = await route({
            handler: () => new Response('raw', { status: 201 }),
        })(new Request('https://example.test/raw'))

        expect(response.status).toBe(201)
        expect(await response.text()).toBe('raw')
    })

    it('supports the response alias on an individual route', async () => {
        const route = createRoute()
        const GET = route({
            response: {
                name: 'route-response',
                serialize(value) {
                    return Response.json({ wrapped: value })
                },
            },
            handler: () => ({ ok: true }),
        })

        const response = await GET(new Request('https://example.test/route-response'))

        expect(await response.json()).toEqual({ wrapped: { ok: true } })
    })

    it('snapshots the input definition when compiling a route', async () => {
        const route = createRoute()
        const options: {
            input: string
            handler: (context: { input: string }) => string
        } = {
            input: 'initial',
            handler: ({ input }) => input,
        }
        const GET = route(options)
        options.input = 'mutated'

        const response = await GET(new Request('https://example.test/input-snapshot'))

        expect(await response.json()).toBe('initial')
    })

    it('resolves standard request input sources as one typed input object', async () => {
        const route = createRoute()
        const POST = route({
            input: {
                body: jsonBody<{ name: string }>(),
                query: query(),
                params: params<{ id: string }>(),
                headers: headers(),
            },
            handler: ({ input }) => ({
                name: input.body.name,
                id: input.params.id,
                tags: input.query.tag,
                authorization: input.headers.get('authorization'),
            }),
        })

        const response = await POST(
            new Request('https://example.test/users/7?tag=one&tag=two', {
                method: 'POST',
                body: JSON.stringify({ name: 'Ada' }),
                headers: {
                    authorization: 'Bearer token',
                    'content-type': 'application/json',
                },
            }),
            { params: Promise.resolve({ id: '7' }) },
        )

        expect(await response.json()).toEqual({
            name: 'Ada',
            id: '7',
            tags: ['one', 'two'],
            authorization: 'Bearer token',
        })
    })

    it('supports textBody without consuming the request more than once', async () => {
        const route = createRoute()
        const POST = route({
            input: textBody(),
            handler: ({ input }) => input.toUpperCase(),
        })

        const response = await POST(
            new Request('https://example.test/text', {
                method: 'POST',
                body: 'hello',
            }),
        )

        expect(await response.json()).toBe('HELLO')
    })

    it('supports mixed input sources and literal input values', async () => {
        const route = createRoute()
        const POST = route({
            input: {
                body: jsonBody<{ name: string }>(),
                version: 'v1',
            },
            handler: ({ input }) => ({
                name: input.body.name,
                version: input.version,
            }),
        })

        const response = await POST(
            new Request('https://example.test/mixed', {
                method: 'POST',
                body: JSON.stringify({ name: 'Ada' }),
            }),
        )

        expect(await response.json()).toEqual({ name: 'Ada', version: 'v1' })
    })

    it('snapshots a source map when compiling a route', async () => {
        const route = createRoute()
        const sources = { value: headers() }
        const GET = route({
            input: sources,
            handler: ({ input }) => input.value.get('x-value'),
        })

        Reflect.set(sources, 'value', textBody())

        const response = await GET(
            new Request('https://example.test/source-snapshot', {
                headers: { 'x-value': 'original' },
            }),
        )

        expect(await response.json()).toBe('original')
    })

    it('keeps reserved query keys as ordinary input data', async () => {
        const route = createRoute()
        const GET = route({
            input: query(),
            handler: ({ input }) => input,
        })

        const response = await GET(new Request('https://example.test/query?constructor=one&__proto__=two'))

        expect(await response.json()).toEqual(
            Object.fromEntries([
                ['constructor', 'one'],
                ['__proto__', 'two'],
            ]),
        )
    })
})
