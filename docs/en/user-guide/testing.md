# Testing Route Handlers

**English** · [简体中文](../../zh-CN/user-guide/testing.md)

```bash
npm install -D @next-route-kit/testing
```

The helpers use native `Request` and `Response` and do not choose a test
runner.

## Direct test

```ts
const POST = createRoute()({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ greeting: 'Hello ' + body.name }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api').json({ name: 'Ada' }))

await expectResponse(response).toHaveStatus(200).toHaveJson({ greeting: 'Hello Ada' })
```

## Test the shared chain

Use the same Factory imported by the application route:

```ts
const response = await invokeRoute(
    POST,
    RequestBuilder.post('/api/tenants/tenant-demo/resources')
        .params({ tenantId: 'tenant-demo' })
        .query({ preview: 'true' })
        .header('authorization', 'Bearer sample-token')
        .header('x-request-id', 'request-demo')
        .json({ label: 'sample', size: 2 }),
)

const payload = await expectResponse(response)
    .toBeOk()
    .toHaveHeader('x-route-kit', 'real-chain')
    .json<{ data: { resourceId: string }; meta: { requestId: string } }>()

expect(payload.meta.requestId).toBe('request-demo')
```

Also test an unauthenticated malformed body and an authenticated validation
error. The repository's real-chain test covers all three outcomes and asserts
that the Handler is not called when a Guard or Pipe stops it.

`RequestBuilder` is immutable and supports query, headers, JSON/text/raw bodies,
and Promise-based params. `ResponseAssertions` caches body reads.
