import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createRoute } from 'next-route-kit'
import { ZodValidationError, zodBody, zodExceptionFilter, zodPipe, zodQuery } from '../src/index.js'

describe('zod adapter', () => {
    it('validates and transforms one route argument with inferred output types', async () => {
        const schema = z.object({ id: z.string(), count: z.number() })
        const pipe = zodPipe(schema)
        const value: z.output<typeof schema> = await pipe.transform({ id: 'route-1', count: 2 }, { type: 'body', name: 'json-body' })

        expect(value).toEqual({ id: 'route-1', count: 2 })
    })

    it('can target only one argument when a route declares body and query', async () => {
        const pipe = zodPipe(z.object({ id: z.string() }), { appliesTo: 'body' })
        const queryValue = { page: '1' }

        await expect(pipe.transform(queryValue, { type: 'query', name: 'query' })).resolves.toEqual(queryValue)
    })

    it('binds JSON parsing, Zod transformation, and handler body inference', async () => {
        const schema = z.object({ count: z.string().transform(Number) })
        const POST = createRoute({ exceptionFilters: [zodExceptionFilter()] })({
            body: zodBody(schema),
            handler: (_request, { body }) => {
                const count: number = body.count
                return { count }
            },
        })

        const response = await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ count: '2' }) }))

        expect(await response.json()).toEqual({ count: 2 })
    })

    it('binds query parsing, validation, and handler query inference', async () => {
        const schema = z.object({ page: z.coerce.number().int().positive() })
        const GET = createRoute({ exceptionFilters: [zodExceptionFilter()] })({
            query: zodQuery(schema),
            handler: (_request, { query: values }) => {
                const page: number = values.page
                return { page }
            },
        })

        const response = await GET(new Request('https://example.test?page=3'))

        expect(await response.json()).toEqual({ page: 3 })
    })

    it('wraps schema issues with immutable metadata', async () => {
        const metadata = Object.freeze({ type: 'body' as const, name: 'json-body' })
        const pipe = zodPipe(z.object({ id: z.string().min(1) }))

        await expect(pipe.transform({ id: '' }, metadata)).rejects.toMatchObject({
            name: 'ZodValidationError',
            metadata,
        })

        try {
            await pipe.transform({ id: '' }, metadata)
        } catch (error) {
            expect(error).toBeInstanceOf(ZodValidationError)
            expect(Object.isFrozen((error as ZodValidationError).issues)).toBe(true)
            expect((error as ZodValidationError).issues[0]?.path).toEqual(['id'])
            expect((error as ZodValidationError).input).toBeUndefined()
        }
    })

    it('retains rejected input only when explicitly requested', async () => {
        const rejectedInput = { password: 'secret' }
        const pipe = zodPipe(z.object({ id: z.string() }), { captureInput: true })

        try {
            await pipe.transform(rejectedInput, { type: 'body', name: 'json-body' })
        } catch (error) {
            expect(error).toBeInstanceOf(ZodValidationError)
            expect((error as ZodValidationError).input).toBe(rejectedInput)
        }
    })

    it('exposes only stable, client-safe issue fields', () => {
        const error = new ZodValidationError(
            {
                issues: [
                    {
                        code: 'custom',
                        message: 'password is invalid',
                        path: ['password'],
                        input: 'secret',
                        internalRule: 'credential-policy-v2',
                    },
                ],
            },
            { password: 'secret' },
            { type: 'body', name: 'json-body' },
        )

        expect(error.input).toBeUndefined()
        expect(error.issues).toEqual([{ code: 'custom', message: 'password is invalid', path: ['password'] }])
    })

    it('maps validation failures to a configurable JSON response', async () => {
        const filter = zodExceptionFilter({ status: 422, code: 'INVALID_INPUT' })
        const error = new ZodValidationError({ issues: [{ code: 'custom', message: 'id is required', path: ['id'] }] }, {}, { type: 'body', name: 'json-body' })

        const response = filter.catch(error, {
            request: new Request('https://example.test'),
            params: {},
            args: {},
            locals: {},
            meta: {},
        })

        expect(response?.status).toBe(422)
        expect(await response?.json()).toEqual({
            code: 'INVALID_INPUT',
            message: 'Input validation failed',
            issues: [{ code: 'custom', message: 'id is required', path: ['id'] }],
        })
    })

    it('ignores unrelated errors', () => {
        expect(
            zodExceptionFilter().catch(new Error('unrelated'), {
                request: new Request('https://example.test'),
                params: {},
                args: {},
                locals: {},
                meta: {},
            }),
        ).toBeUndefined()
    })
})
