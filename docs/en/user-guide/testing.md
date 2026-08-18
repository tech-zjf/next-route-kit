# Testing Route Handlers

[简体中文](../../zh-CN/user-guide/testing.md) · **English**

Install the runner-neutral testing package as a development dependency:

```bash
pnpm add -D @next-route-kit/testing
```

It uses native `Request` and `Response` and does not force Vitest, Jest, Node's
test runner, or another assertion framework.

For the reason to test a shared pipeline instead of only a bare
`createRoute()`, see [Why use next-route-kit?](./why-route-kit.md). The
repository's real-chain test uses an authenticated order flow and checks
success, unauthorized, and invalid-input behavior.

## Invoke a Route Handler

```ts
import { createRoute, jsonBody } from 'next-route-kit'
import { expectResponse, invokeRoute, RequestBuilder } from '@next-route-kit/testing'

const route = createRoute()
const POST = route({
    input: jsonBody<{ name: string }>(),
    handler: ({ input }) => ({ greeting: `Hello ${input.name}` }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api/greeting').json({ name: 'Ada' }))

await expectResponse(response).toHaveStatus(200).toHaveJson({ greeting: 'Hello Ada' })
```

## Test a real business route

Keep the Factory setup in application code and test the Route Handler that
uses it. This example exercises dynamic params, authentication, JSON input,
validation, and the response contract in one request:

```ts
const response = await invokeRoute(
    POST,
    RequestBuilder.post('/api/accounts/acct-7/orders')
        .params({ accountId: 'acct-7' })
        .query({ preview: 'true' })
        .header('authorization', 'Bearer demo-token')
        .header('x-request-id', 'req-7')
        .json({ sku: 'sku-42', quantity: 2 }),
)

const payload = await expectResponse(response)
    .toBeOk()
    .toHaveHeader('x-route-kit', 'real-chain')
    .json<{ data: { orderId: string }; meta: { requestId: string } }>()

expect(payload.data.orderId).toBe('order-user-42-sku-42')
expect(payload.meta.requestId).toBe('req-7')
```

Add separate cases for missing credentials and invalid input. The important
assertion is not only the final JSON: an unauthenticated request should return
`401` before a malformed body is parsed, while an authenticated invalid order
should return the documented validation error without calling the Handler.

`invokeRoute` accepts a native `Request`, a `RequestBuilder`, or a
`RouteTestRequest` containing a request and a Promise-based params context.

## `RequestBuilder`

The builder is immutable; every method returns a new builder.

| Method                       | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `RequestBuilder.get(url?)`   | Start a GET request.                                  |
| `RequestBuilder.post(url?)`  | Start a POST request.                                 |
| `.method(method)`            | Set the HTTP method.                                  |
| `.query(name, value)`        | Set one query key.                                    |
| `.query({ key: value })`     | Set multiple query keys; arrays create repeated keys. |
| `.header(name, value)`       | Set one header.                                       |
| `.headers(values)`           | Merge headers.                                        |
| `.json(value)`               | Serialize JSON and set a default JSON content type.   |
| `.text(value, contentType?)` | Set a text body and content type.                     |
| `.body(value, contentType?)` | Set a raw `BodyInit`.                                 |
| `.params(params)`            | Provide dynamic Route Handler params.                 |
| `.build()`                   | Build a native `Request`.                             |
| `.buildContext()`            | Build a Promise-based params context.                 |
| `.buildRouteRequest()`       | Build both request and context.                       |

Example with a dynamic route and repeated query keys:

```ts
const request = RequestBuilder.get<{ id: string }>('/api/users')
    .query({ tag: ['one', 'two'], page: 2 })
    .header('authorization', 'Bearer test-token')
    .params({ id: '42' })

const response = await invokeRoute(GET, request)
```

## `expectResponse`

```ts
const assertion = expectResponse(response)

assertion.toBeOk()
assertion.toHaveStatus(200)
assertion.toHaveHeader('content-type', 'application/json')
await assertion.toHaveJson({ ok: true })
await assertion.toHaveText('plain text')
```

Response body reads are cached, so the same assertion object can inspect text
and JSON without consuming the response twice.

## Test plugins

Use `createTestPlugin` to verify plugin installation and Factory composition:

```ts
import { createTestPlugin } from '@next-route-kit/testing'

const plugin = createTestPlugin('trace', {
    middleware: [traceMiddleware],
})

const route = createRoute({ plugins: [plugin] })
expect(plugin.installCount).toBe(1)
```

The package is a helper library, not a Next.js server simulator. Use the
project's Next.js compatibility fixtures or an application integration test for
routing, caching, bundling, and Node/Edge behavior.
