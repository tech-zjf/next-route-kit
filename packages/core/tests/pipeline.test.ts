import { describe, expect, it } from 'vitest'
import {
    DuplicateInterceptorNextError,
    executeRoutePipeline,
    forbidden,
    NativeResponseNotAllowedError,
    RoutePipeline,
    type RouteContext,
} from '../src/index.js'

function createContext(): RouteContext {
    return {
        request: new Request('https://example.test/users'),
        params: {},
        args: { body: { value: 'raw' } },
        locals: {},
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
    it('supports adapter context preparation before middleware', async () => {
        const events: string[] = []

        const response = await executeRoutePipeline(
            {
                middleware: [
                    {
                        name: 'middleware',
                        use(context, next) {
                            events.push(`middleware:${(context.params as { id?: string }).id}`)
                            return next()
                        },
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: (context) => context.params,
            },
            {
                ...createContext(),
                params: {},
            },
            undefined,
            async (context) => {
                context.params = { id: 'prepared' }
            },
        )

        expect(events).toEqual(['middleware:prepared'])
        expect(await response.json()).toEqual({ id: 'prepared' })
    })

    it('passes per-argument metadata to pipes', async () => {
        let receivedMetadata: unknown

        const response = await executeRoutePipeline(
            {
                pipes: [
                    {
                        name: 'metadata-observer',
                        transform(value, metadata) {
                            receivedMetadata = metadata
                            return value
                        },
                    },
                ],
                responseSerializer: jsonSerializer,
                handler: (context) => context.args,
            },
            {
                ...createContext(),
                args: { body: { ok: true } },
                argumentMetadata: {
                    type: 'custom',
                    name: 'route-arguments',
                    fields: {
                        body: { type: 'body', name: 'json-body' },
                    },
                },
            },
        )

        expect(receivedMetadata).toEqual({ type: 'body', name: 'json-body' })
        expect(await response.json()).toEqual({ body: { ok: true } })
    })

    it('runs the request lifecycle in order', async () => {
        const events: string[] = []

        const response = await executeRoutePipeline(
            {
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
                pipes: [
                    {
                        name: 'pipe',
                        transform(value, metadata) {
                            events.push('pipe:' + metadata.type)
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
                    return context.args.body
                },
            },
            {
                ...createContext(),
                argumentMetadata: {
                    type: 'custom',
                    name: 'route-arguments',
                    fields: { body: { type: 'body', name: 'json-body' } },
                },
            },
        )

        expect(events).toEqual(['middleware:before', 'guard', 'interceptor:before', 'pipe:body', 'handler', 'interceptor:after', 'middleware:after'])
        expect(await response.json()).toEqual({ value: 'parsed' })
    })

    it('runs preparation and pipes inside the interceptor boundary', async () => {
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
            pipes: [
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
            context.args = { body: { value: 'prepared' } }
            context.argumentMetadata = {
                type: 'custom',
                name: 'route-arguments',
                fields: { body: { type: 'body', name: 'json-body' } },
            }
        })

        expect(events).toEqual(['guard', 'interceptor:before', 'prepare', 'pipe', 'handler', 'interceptor:after'])
        expect(await response.json()).toEqual({ ok: true })
    })

    it('rejects an interceptor that calls next more than once without repeating the handler', async () => {
        let handlerCalls = 0

        await expect(
            executeRoutePipeline(
                {
                    interceptors: [
                        {
                            name: 'duplicate-next',
                            async intercept(_context, next) {
                                await next()
                                return next()
                            },
                        },
                    ],
                    responseSerializer: jsonSerializer,
                    handler() {
                        handlerCalls += 1
                        return { ok: true }
                    },
                },
                createContext(),
            ),
        ).rejects.toBeInstanceOf(DuplicateInterceptorNextError)

        expect(handlerCalls).toBe(1)
    })

    it('hydrates adapter context before middleware and guards', async () => {
        const events: string[] = []
        const context = createContext()

        const response = await new RoutePipeline({
            middleware: [
                {
                    name: 'middleware',
                    use(currentContext, next) {
                        events.push('middleware:' + currentContext.params.id)
                        return next()
                    },
                },
            ],
            guards: [
                {
                    name: 'guard',
                    canActivate(currentContext) {
                        events.push('guard:' + currentContext.params.id)
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
            context.params = { id: 'sample-id' }
        })

        expect(events).toEqual(['context', 'middleware:sample-id', 'guard:sample-id', 'handler'])
        expect(await response.json()).toEqual({ ok: true })
    })

    it('lets middleware transform the handler result before serialization', async () => {
        const response = await executeRoutePipeline(
            {
                middleware: [
                    {
                        name: 'result-transformer',
                        async use(_context, next) {
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

    it('maps a denied guard through an exception filter', async () => {
        const response = await executeRoutePipeline(
            {
                guards: [
                    {
                        name: 'deny',
                        canActivate: () => false,
                    },
                ],
                exceptionFilters: [
                    {
                        name: 'http-error',
                        catch(error) {
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

    it('maps errors from request preparation through an exception filter', async () => {
        const response = await new RoutePipeline({
            exceptionFilters: [
                {
                    name: 'preparation-error',
                    catch(error) {
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

    it('returns a guard Response without running interceptors or the handler', async () => {
        let handlerCalled = false
        let interceptorCalled = false

        const response = await executeRoutePipeline(
            {
                guards: [
                    {
                        name: 'short-circuit',
                        canActivate: () => Response.json({ ok: false }, { status: 401 }),
                    },
                ],
                interceptors: [
                    {
                        name: 'interceptor',
                        intercept(_context, next) {
                            interceptorCalled = true
                            return next()
                        },
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
        expect(interceptorCalled).toBe(false)
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

    it('maps asynchronous response serializer failures through exception filters', async () => {
        const response = await executeRoutePipeline(
            {
                exceptionFilters: [
                    {
                        name: 'serializer-error',
                        catch(error) {
                            if (error instanceof Error && error.message === 'serializer failed') {
                                return Response.json({ code: 'SERIALIZER_FAILED' }, { status: 500 })
                            }

                            return undefined
                        },
                    },
                ],
                responseSerializer: {
                    name: 'throwing',
                    async serialize() {
                        throw new Error('serializer failed')
                    },
                },
                handler: () => ({ ok: true }),
            },
            createContext(),
        )

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ code: 'SERIALIZER_FAILED' })
    })

    it('rejects native Response values when the pipeline uses a strict response policy', async () => {
        await expect(
            executeRoutePipeline(
                {
                    nativeResponse: 'reject',
                    responseSerializer: jsonSerializer,
                    handler: () => Response.json({ bypassed: true }),
                },
                createContext(),
            ),
        ).rejects.toBeInstanceOf(NativeResponseNotAllowedError)
    })

    it('applies the strict response policy to guard short circuits', async () => {
        const response = await executeRoutePipeline(
            {
                nativeResponse: 'reject',
                guards: [
                    {
                        name: 'short-circuit',
                        canActivate: () => Response.json({ bypassed: true }),
                    },
                ],
                exceptionFilters: [
                    {
                        name: 'strict-response-error',
                        catch(error) {
                            if (error instanceof NativeResponseNotAllowedError) {
                                return Response.json({ code: 'NATIVE_RESPONSE_REJECTED' }, { status: 500 })
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

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ code: 'NATIVE_RESPONSE_REJECTED' })
    })

    it('exports the explicit forbidden helper for guard implementations', () => {
        expect(forbidden().status).toBe(403)
    })
})
