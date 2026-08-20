import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiException, apiResponsePlugin, createRoute, type ApiResponseData } from '../src/index.js'

const ResponseCode = {
    SUCCESS: { code: 'OK', msg: 'Success' },
    QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', msg: 'Quota exceeded', status: 409 },
    INVALID_INPUT: { code: 'INVALID_INPUT', msg: 'Invalid input', status: 422 },
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', msg: 'Internal server error' },
} as const

afterEach(() => {
    vi.restoreAllMocks()
})

function createApiRoute(options: { readonly onUnknownError?: (error: unknown) => void } = {}) {
    return createRoute({
        plugins: [
            apiResponsePlugin({
                success: ResponseCode.SUCCESS,
                systemError: ResponseCode.INTERNAL_ERROR,
                ...(options.onUnknownError
                    ? {
                          onUnknownError: (error: unknown) => {
                              options.onUnknownError?.(error)
                          },
                      }
                    : {}),
            }),
        ],
    })
}

describe('api response contract', () => {
    it('wraps successful business data as { code, msg, data }', async () => {
        const GET = createApiRoute()({
            handler: () => ({ resource: { id: 'resource-demo' } }),
        })

        const response = await GET(new Request('https://example.test/resources/resource-demo'))

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            code: 'OK',
            msg: 'Success',
            data: { resource: { id: 'resource-demo' } },
        })
    })

    it('maps ApiException to the business code and keeps error data as an object', async () => {
        const GET = createApiRoute()({
            handler: () => {
                throw new ApiException(ResponseCode.QUOTA_EXCEEDED, {
                    data: { requested: 10, available: 3 },
                })
            },
        })

        const response = await GET(new Request('https://example.test/quota'))

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({
            code: 'QUOTA_EXCEEDED',
            msg: 'Quota exceeded',
            data: { requested: 10, available: 3 },
        })
    })

    it('maps unexpected errors to the configured system code and reports them', async () => {
        const unexpected = new Error('database connection details')
        let reported: unknown
        const GET = createApiRoute({ onUnknownError: (error) => (reported = error) })({
            handler: () => {
                throw unexpected
            },
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
            code: 'INTERNAL_ERROR',
            msg: 'Internal server error',
            data: {},
        })
        expect(reported).toBe(unexpected)
    })

    it('reports unexpected errors to the console when no reporter is configured', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const unexpected = new Error('database connection details')
        const GET = createApiRoute()({
            handler: () => {
                throw unexpected
            },
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalledWith('[next-route-kit] Unhandled route error', { method: 'GET', pathname: '/resources' }, unexpected)
    })

    it('preserves the system response and logs when a custom reporter fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const unexpected = new Error('database connection details')
        const reportingError = new Error('reporting service unavailable')
        const GET = createApiRoute({
            onUnknownError() {
                throw reportingError
            },
        })({
            handler: () => {
                throw unexpected
            },
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(response.status).toBe(500)
        expect(await response.json()).toMatchObject({ code: 'INTERNAL_ERROR' })
        expect(consoleError).toHaveBeenCalledWith(
            '[next-route-kit] Unknown-error reporter failed',
            { method: 'GET', pathname: '/resources' },
            { error: unexpected, reportingError },
        )
    })

    it('maps optional-adapter errors without coupling the response plugin to that adapter', async () => {
        const validationError = new Error('validation details')
        const GET = createRoute({
            plugins: [
                apiResponsePlugin({
                    success: ResponseCode.SUCCESS,
                    systemError: ResponseCode.INTERNAL_ERROR,
                    mapError: (error) =>
                        error === validationError
                            ? {
                                  code: ResponseCode.INVALID_INPUT,
                                  data: { fields: ['name'] },
                              }
                            : undefined,
                }),
            ],
        })({
            handler: () => {
                throw validationError
            },
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
            code: 'INVALID_INPUT',
            msg: 'Invalid input',
            data: { fields: ['name'] },
        })
    })

    it('lets the application map list results into an object without weakening the contract', async () => {
        const GET = createRoute({
            plugins: [
                apiResponsePlugin({
                    success: ResponseCode.SUCCESS,
                    systemError: ResponseCode.INTERNAL_ERROR,
                    mapData: (value) => ({ items: value as ApiResponseData[] }),
                }),
            ],
        })({
            handler: () => [{ id: 'resource-1' }],
        })

        const response = await GET(new Request('https://example.test/resources'))

        expect(await response.json()).toEqual({
            code: 'OK',
            msg: 'Success',
            data: { items: [{ id: 'resource-1' }] },
        })
    })

    it('passes native Response values through unchanged', async () => {
        const GET = createApiRoute()({
            handler: () => Response.json({ downloadUrl: 'https://example.test/file' }, { status: 202 }),
        })

        const response = await GET(new Request('https://example.test/files'))

        expect(response.status).toBe(202)
        expect(await response.json()).toEqual({ downloadUrl: 'https://example.test/file' })
    })
})
