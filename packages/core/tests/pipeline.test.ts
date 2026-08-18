import { describe, expect, it } from 'vitest'
import { executeRoutePipeline, forbidden, RoutePipeline, type RouteContext } from '../src/index.js'

function createContext(): RouteContext {
    return {
        request: new Request('https://example.test/users'),
        params: {},
        input: { value: 'raw' },
        state: {},
        meta: { method: 'GET', pathname: '/users' },
    }
}

const jsonSerializer = {
    name: 'json',
    serialize(value: unknown): Response {
        return Response.json(value)
    },
}

describe('executeRoutePipeline', () => {
    it('passes route input metadata to input pipes', async () => {
        const inputMetadata = { location: 'body' as const, name: 'json-body' }
        let receivedMetadata: unknown

        const response = await executeRoutePipeline(
            {
                inputPipes: [
                    {
                        name: 'metadata-observer',
                        transform(value, metadata) {
                            receivedMetadata = metadata
                            return value
                        },
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: (context) => context.input,
            },
            { ...createContext(), inputMetadata },
        )

        expect(receivedMetadata).toBe(inputMetadata)
        expect(await response.json()).toEqual({ value: 'raw' })
    })

    it('runs middleware, guards, pipes, interceptors, and the handler in order', async () => {
        const events: string[] = []

        const response = await executeRoutePipeline(
            {
                middleware: [
                    {
                        name: 'middleware',
                        async handle(_context, next) {
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
                inputPipes: [
                    {
                        name: 'pipe',
                        transform(value) {
                            events.push('pipe')
                            return { ...(value as { value: string }), value: 'parsed' }
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
                responseSerializer: jsonSerializer,
                handler(context) {
                    events.push('handler')
                    return context.input
                },
            },
            createContext(),
        )

        expect(events).toEqual(['middleware:before', 'guard', 'pipe', 'interceptor:before', 'handler', 'interceptor:after', 'middleware:after'])
        expect(await response.json()).toEqual({ value: 'parsed' })
    })

    it('runs preparation after guards and before pipes and interceptors', async () => {
        const events: string[] = []
        const context = createContext()

        const response = await new RoutePipeline({
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
            responseSerializer: jsonSerializer,
            handler() {
                events.push('handler')
                return { ok: true }
            },
        }).execute(context, () => {
            events.push('prepare')
            context.input = { value: 'prepared' }
        })

        expect(events).toEqual(['guard', 'prepare', 'pipe', 'interceptor:before', 'handler', 'interceptor:after'])
        expect(await response.json()).toEqual({ ok: true })
    })

    it('hydrates adapter context before middleware and guards', async () => {
        const events: string[] = []
        const context = createContext()

        const response = await new RoutePipeline({
            middleware: [
                {
                    name: 'middleware',
                    handle(currentContext, next) {
                        events.push(`middleware:${currentContext.params.id}`)
                        return next()
                    },
                },
            ],
            guards: [
                {
                    name: 'guard',
                    canActivate(currentContext) {
                        events.push(`guard:${currentContext.params.id}`)
                        return true
                    },
                },
            ],
            responseSerializer: jsonSerializer,
            handler() {
                events.push('handler')
                return { ok: true }
            },
        }).execute(context, undefined, () => {
            events.push('context')
            context.params = { id: '42' }
        })

        expect(events).toEqual(['context', 'middleware:42', 'guard:42', 'handler'])
        expect(await response.json()).toEqual({ ok: true })
    })

    it('lets middleware transform the handler result before serialization', async () => {
        const response = await executeRoutePipeline(
            {
                middleware: [
                    {
                        name: 'result-transformer',
                        async handle(_context, next) {
                            const result = (await next()) as { ok: boolean }
                            return { ...result, transformed: true }
                        },
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: () => ({ ok: true }),
            },
            createContext(),
        )

        expect(await response.json()).toEqual({ ok: true, transformed: true })
    })

    it('maps a denied guard through the configured error mapper', async () => {
        const response = await executeRoutePipeline(
            {
                guards: [
                    {
                        name: 'deny',
                        canActivate: () => false,
                    },
                ],
                errorMappers: [
                    {
                        name: 'http-error',
                        map(error) {
                            if (error instanceof Error && error.message.includes('permission')) {
                                return Response.json({ code: 'FORBIDDEN' }, { status: 403 })
                            }

                            return undefined
                        },
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: () => ({ shouldNotRun: true }),
            },
            createContext(),
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ code: 'FORBIDDEN' })
    })

    it('maps errors from request preparation through the configured error mapper', async () => {
        const response = await new RoutePipeline({
            errorMappers: [
                {
                    name: 'preparation-error',
                    map(error) {
                        if (error instanceof Error && error.message === 'invalid input') {
                            return Response.json({ code: 'INVALID_INPUT' }, { status: 422 })
                        }

                        return undefined
                    },
                },
            ],
            responseSerializer: jsonSerializer,
            handler: () => ({ shouldNotRun: true }),
        }).execute(createContext(), () => {
            throw new Error('invalid input')
        })

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
    })

    it('returns a guard Response without running the handler', async () => {
        let handlerCalled = false

        const response = await executeRoutePipeline(
            {
                guards: [
                    {
                        name: 'short-circuit',
                        canActivate: () => Response.json({ ok: false }, { status: 401 }),
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: () => {
                    handlerCalled = true
                    return { ok: true }
                },
            },
            createContext(),
        )

        expect(handlerCalled).toBe(false)
        expect(response.status).toBe(401)
    })

    it('passes through an existing Response without a serializer', async () => {
        const response = await executeRoutePipeline(
            {
                handler: () => new Response('ok'),
            },
            createContext(),
        )

        expect(await response.text()).toBe('ok')
    })

    it('throws when a non-Response result has no serializer', async () => {
        await expect(
            executeRoutePipeline(
                {
                    handler: () => ({ ok: true }),
                },
                createContext(),
            ),
        ).rejects.toThrow('ResponseSerializer')
    })

    it('exports the explicit forbidden helper for guard implementations', () => {
        expect(forbidden().status).toBe(403)
    })
})
