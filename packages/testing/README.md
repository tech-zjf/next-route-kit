# @next-route-kit/testing

Test helpers for native-compatible Route Handlers. The package does not depend on
Vitest, Jest, or another assertion runner.

```bash
npm install -D @next-route-kit/testing
```

```ts
import { createRoute, jsonBody } from 'next-route-kit'
import { expectResponse, invokeRoute, RequestBuilder } from '@next-route-kit/testing'

const POST = createRoute()({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ greeting: 'Hello ' + body.name }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api/greeting').json({ name: 'Ada' }))

await expectResponse(response).toHaveStatus(200).toHaveJson({ greeting: 'Hello Ada' })
```

`RequestBuilder` supports method, query, headers, JSON/text/raw bodies, and
Promise-based Next `params`. It is immutable. `ResponseAssertions` caches
one-shot body reads. `createTestPlugin()` provides a deterministic plugin double.

The repository also tests an authenticated resource flow through request ID,
Guard, declared body/query resolution, per-argument Pipe, Interceptor,
ExceptionFilter, and Handler. The helpers invoke the exported Handler directly;
Next routing and bundler compatibility remain covered by the Next 15/16 fixtures.
