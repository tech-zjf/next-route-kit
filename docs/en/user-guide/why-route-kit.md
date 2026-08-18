# Why use next-route-kit?

**English** · [简体中文](../../zh-CN/user-guide/why-route-kit.md)

Use this package when many Route Handlers repeat the same policy code. Do not use
it only to make a one-off route look more abstract.

## A repeated route problem

A typical authenticated JSON route often contains request ID setup, auth,
body parsing, validation, response envelopes, and a try/catch around the service
call:

```ts
export async function POST(request: Request, context: NextContext) {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const auth = await getCurrentAuth(request)

    if (!auth) {
        return Response.json({ code: 'UNAUTHORIZED', requestId }, { status: 401 })
    }

    try {
        const body = await request.json()
        if (!isValidResource(body)) {
            return Response.json({ code: 'INVALID_INPUT', requestId }, { status: 422 })
        }

        const params = await context.params
        const result = await resourceService.create({
            tenantId: params.tenantId,
            userId: auth.userId,
            body,
        })

        return Response.json({ data: result, requestId })
    } catch (error) {
        return toApiError(error, requestId)
    }
}
```

That is fine once. Across dozens of routes it becomes repeated policy and
drifts between endpoints.

## The same route with a shared scope

```ts
const apiRoute = createRoute<ApiLocals>({
    middleware: [requestIdMiddleware],
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
})

const authenticatedRoute = apiRoute.extend({
    guards: [authenticationGuard],
})

export const POST = authenticatedRoute<ResourceParams, ResourceBody>({
    body: jsonBody<ResourceBody>(),
    handler: async (_request, { params, body, locals }) =>
        resourceService.create({
            tenantId: params.tenantId,
            userId: locals.userId,
            body,
        }),
})
```

The route file now shows the unique input and business call. The shared policy
remains visible at the imported Factory.

## What improves

- one implementation of request-local setup, authentication, envelopes, and
  exception responses;
- a fixed order that authenticates before body resolution;
- explicit, immutable public/authenticated/admin scopes;
- native Request first and native Response return values;
- tests that exercise the same exported Handler users deploy.

## What stays native

Keep a native Next Handler when that is clearer for streams, multipart uploads,
signed webhooks, cron secrets, or complex multi-stage jobs. The package removes
repeated policy; it should not create an abstraction for every route.
