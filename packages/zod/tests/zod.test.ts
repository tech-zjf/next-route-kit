import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ZodValidationError, zodErrorMapper, zodPipe } from '../src/index.js'

describe('zod adapter', () => {
    it('validates and transforms input with inferred output types', async () => {
        const schema = z.object({ id: z.string(), count: z.number() })
        const pipe = zodPipe(schema)
        const value: z.output<typeof schema> = await pipe.transform({ id: 'route-1', count: 2 }, { location: 'custom', name: 'route-input' })

        expect(value).toEqual({ id: 'route-1', count: 2 })
    })

    it('wraps schema issues with immutable metadata', async () => {
        const metadata = Object.freeze({ location: 'body' as const, name: 'json-body' })
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
        }
    })

    it('maps validation failures to a configurable JSON response', async () => {
        const mapper = zodErrorMapper({ status: 422, code: 'INVALID_INPUT' })
        const error = new ZodValidationError(
            { issues: [{ code: 'custom', message: 'id is required', path: ['id'] }] },
            {},
            { location: 'custom', name: 'route-input' },
        )

        const response = mapper.map(error, {
            request: new Request('https://example.test'),
            params: {},
            input: {},
            state: {},
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
            zodErrorMapper().map(new Error('unrelated'), {
                request: new Request('https://example.test'),
                params: {},
                input: {},
                state: {},
                meta: {},
            }),
        ).toBeUndefined()
    })
})
