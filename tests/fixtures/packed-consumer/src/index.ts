import { z } from 'zod'
import { createRoute, jsonBody, query, RuntimeIncompatiblePluginError } from 'next-route-kit'
import { zodExceptionFilter, zodPipe } from '@next-route-kit/zod'
import { expectResponse, invokeRoute, RequestBuilder } from '@next-route-kit/testing'

const bodySchema = z.object({ name: z.string().min(1) })
const querySchema = z.object({ mode: z.literal('packed') })
const route = createRoute({
    pipes: [zodPipe(bodySchema, { appliesTo: 'body' }), zodPipe(querySchema, { appliesTo: 'query' })],
    exceptionFilters: [zodExceptionFilter()],
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
    body: jsonBody<z.input<typeof bodySchema>>(),
    query: query<z.input<typeof querySchema>>(),
    handler: (_request, { body, query: values }) => ({
        ok: true,
        value: body.name,
        mode: values.mode,
    }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api').query({ mode: 'packed' }).json({ name: 'packed' }))
const responseAssertions = expectResponse(response).toHaveStatus(200)
const payload = await responseAssertions.json<{ ok: boolean; value: string; mode: string }>()

if (!response.ok || payload.ok !== true || payload.value !== 'packed' || payload.mode !== 'packed') {
    throw new Error(`Packed consumer smoke test failed: ${JSON.stringify(payload)}`)
}

await responseAssertions.toHaveJson({ ok: true, value: 'packed', mode: 'packed' })

const invalidResponse = await invokeRoute(POST, RequestBuilder.post('/api').query({ mode: 'packed' }).json({ name: '' }))
const invalidPayload = await expectResponse(invalidResponse).toHaveStatus(400).json<{ code: string }>()

if (invalidResponse.status !== 400 || invalidPayload.code !== 'VALIDATION_ERROR') {
    throw new Error(`Packed consumer validation test failed: ${JSON.stringify(invalidPayload)}`)
}

console.log(JSON.stringify({ status: response.status, payload }))
