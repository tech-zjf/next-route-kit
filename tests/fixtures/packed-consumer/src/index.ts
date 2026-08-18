import { z } from 'zod'
import { createRoute, jsonBody, query, RuntimeIncompatiblePluginError } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'
import { expectResponse, invokeRoute, RequestBuilder } from '@next-route-kit/testing'

const bodySchema = z.object({ name: z.string().min(1) })
const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema, query: z.object({ mode: z.literal('packed') }) }))],
    errorMappers: [zodErrorMapper()],
})

let runtimeDiagnostic = false
try {
    createRoute({
        runtime: 'edge',
        plugins: [
            {
                name: 'node-only',
                runtime: 'nodejs',
                install() {
                    return {}
                },
            },
        ],
    })
} catch (error) {
    runtimeDiagnostic = error instanceof RuntimeIncompatiblePluginError
}

if (!runtimeDiagnostic) {
    throw new Error('Packed consumer runtime diagnostic test failed')
}

export const POST = route({
    input: {
        body: jsonBody<z.input<typeof bodySchema>>(),
        query: query(),
    },
    handler: ({ input }) => ({
        ok: true,
        value: input.body.name,
    }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api').query({ mode: 'packed' }).json({ name: 'packed' }))
const responseAssertions = expectResponse(response).toHaveStatus(200)
const payload = await responseAssertions.json<{ ok: boolean; value: string }>()

if (!response.ok || payload.ok !== true || payload.value !== 'packed') {
    throw new Error(`Packed consumer smoke test failed: ${JSON.stringify(payload)}`)
}

await responseAssertions.toHaveJson({ ok: true, value: 'packed' })

const invalidResponse = await invokeRoute(POST, RequestBuilder.post('/api').query({ mode: 'packed' }).json({ name: '' }))
const invalidPayload = await expectResponse(invalidResponse).toHaveStatus(400).json<{ code: string }>()

if (invalidResponse.status !== 400 || invalidPayload.code !== 'VALIDATION_ERROR') {
    throw new Error(`Packed consumer validation test failed: ${JSON.stringify(invalidPayload)}`)
}

console.log(JSON.stringify({ status: response.status, payload }))
