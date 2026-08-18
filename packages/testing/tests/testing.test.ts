import { describe, expect, it } from 'vitest'
import { createTestPlugin, expectResponse, invokeRoute, RequestBuilder, ResponseAssertionError } from '../src/index.js'

describe('request testing helpers', () => {
    it('builds an immutable request and async route params', async () => {
        const builder = RequestBuilder.post<{ id: string }>('/api/users')
            .query({ tag: ['one', 'two'], page: 2 })
            .header('x-test', 'enabled')
            .params({ id: 'sample-id' })
            .json({ name: 'Ada' })

        const request = builder.build()

        expect(request.url).toBe('https://example.test/api/users?tag=one&tag=two&page=2')
        expect(request.method).toBe('POST')
        expect(request.headers.get('content-type')).toBe('application/json')
        expect(request.headers.get('x-test')).toBe('enabled')
        expect(await request.json()).toEqual({ name: 'Ada' })
        expect(await builder.buildContext().params).toEqual({ id: 'sample-id' })
    })

    it('invokes a route handler with the builder request and context', async () => {
        const handler = async (_request: Request, context: { params: Promise<{ id: string }> }) => Response.json({ id: (await context.params).id })
        const response = await invokeRoute(handler, RequestBuilder.get<{ id: string }>('/api/users').params({ id: 'sample-id' }))

        await expectResponse(response).toHaveJson({ id: 'sample-id' })
    })

    it('preserves repeated URLSearchParams values', () => {
        const request = RequestBuilder.get('/api/search').query(new URLSearchParams('tag=one&tag=two')).build()

        expect(request.url).toBe('https://example.test/api/search?tag=one&tag=two')
    })

    it('snapshots route params instead of retaining a caller-owned object', async () => {
        const params = { id: 'before' }
        const builder = RequestBuilder.get<{ id: string }>('/api/users').params(params)
        params.id = 'after'

        expect(await builder.buildContext().params).toEqual({ id: 'before' })
    })
})

describe('response assertions', () => {
    it('caches text and JSON reads for one-shot response bodies', async () => {
        const assertions = expectResponse(Response.json({ ok: true }, { status: 201, headers: { 'x-test': 'yes' } }))

        assertions.toBeOk().toHaveStatus(201).toHaveHeader('x-test', 'yes')
        await assertions.toHaveJson({ ok: true })
        await assertions.toHaveText('{"ok":true}')
        expect(await assertions.json()).toEqual({ ok: true })
    })

    it('throws an assertion error with a useful status message', () => {
        expect(() => expectResponse(new Response('nope', { status: 500 })).toHaveStatus(200)).toThrow(ResponseAssertionError)
    })
})

describe('plugin test helper', () => {
    it('tracks deterministic plugin installation count', () => {
        const plugin = createTestPlugin('trace', { middleware: [] }, { runtime: 'both' })

        expect(plugin.installCount).toBe(0)
        expect(plugin.install()).toEqual({ middleware: [] })
        expect(plugin.installCount).toBe(1)
        plugin.reset()
        expect(plugin.installCount).toBe(0)
    })
})
