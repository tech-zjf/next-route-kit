# @next-route-kit/testing

Test helpers for native-compatible `next-route-kit` Route Handlers. The
package does not depend on Vitest, Jest, or another assertion runner.

```bash
pnpm add -D @next-route-kit/testing
```

See the [English testing guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/testing.md) or
[简体中文测试指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/testing.md).

For a complete user-shaped example, see the [English real order-flow
scenario](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/why-route-kit.md)
or [简体中文真实订单流程](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/why-route-kit.md).

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

`RequestBuilder` supports query values, headers, JSON/text/raw bodies, and
Promise-based Route Handler params. The builder is immutable, so request setup
can be shared safely between cases:

```ts
const authenticatedRequest = RequestBuilder.get<{ id: string }>('/api/users')
    .query({ active: true })
    .header('authorization', 'Bearer test-token')
    .params({ id: '42' })
```

`ResponseAssertions` caches one-shot body reads, so the same response can be
checked as text and JSON. `createTestPlugin` creates a deterministic plugin
double with an `installCount` for registry and scope tests. The package only
uses native `Request`/`Response` and does not select a test runner, so it can be
used with Vitest, Jest, Node's test runner, or a custom harness.

The helpers invoke the compiled Route Handler directly. Next.js routing,
runtime, caching, and bundler behavior remain covered by the compatibility
fixtures rather than being simulated by this package. The repository also
uses these helpers to test an authenticated order flow through Middleware,
Guard, Input Resolver, Input Pipe, Interceptor, Handler, and Error Mapper; the
Next.js 15/16 fixtures execute the same flow through actual Route Handler
modules.
