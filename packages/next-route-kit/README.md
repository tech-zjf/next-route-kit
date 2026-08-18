# next-route-kit

The Next.js App Router entry package for `next-route-kit`.

```bash
pnpm add next-route-kit
```

User documentation: [English guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/README.md) ·
[简体中文指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/README.md) · [API reference](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/api-reference.md)

Use it when real application routes repeat the same authentication, request
ID, validation, response envelope, and error mapping code. Define those
policies on a shared Factory, derive scopes for protected resources, and keep
each Route Handler focused on its business operation. See the [English real
user scenario](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/why-route-kit.md)
or [简体中文真实用户场景](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/why-route-kit.md).

```ts
import { createRoute, headers, jsonBody, params, query } from 'next-route-kit'

const route = createRoute({
    middleware: [requestLogger()],
    guards: [requireUser()],
})

export const GET = route({
    handler: async ({ params }) => {
        return { id: params.id }
    },
})

export const POST = route({
    input: {
        body: jsonBody<{ name: string }>(),
        query: query(),
        params: params<{ id: string }>(),
        headers: headers(),
    },
    handler: async ({ input }) => {
        return {
            id: input.params.id,
            name: input.body.name,
            preview: input.query.preview,
            authorization: input.headers.get('authorization'),
        }
    },
})
```

For runtime-specific routes, keep the Factory target aligned with Next.js's
module export. The Core registry then fails early if a plugin declares an
incompatible runtime:

```ts
export const runtime = 'edge'
const route = createRoute({ runtime: 'edge', plugins: [edgeTracing()] })
```

The diagnostic is static configuration validation; it does not replace Next.js
bundle checks, so Node-only plugin imports must still stay out of Edge entrypoints.

`createRoute` is a class-backed root Factory. A configured Factory is explicit
and immutable. Use `route.extend({ ... })` to create a scope factory for a group
of routes. The returned function is a normal Next.js
Route Handler and can be exported as `GET`, `POST`, or another supported method.

`createRoute` does not scan files, replace the App Router, or require runtime
registration in `next.config.ts`.

The request lifecycle is fixed and explicit:

```text
Middleware → Guard → Input Resolver → Input Pipe → Interceptor → Handler
```

Guards therefore run before route input is resolved or a request body is read.
The adapter hydrates `context.params` before middleware and guards so route
authorization can use dynamic params without reading the request body.
The main package also adds `defaultErrorMapper()` after user mappers. It maps
`HttpError` and malformed JSON bodies to JSON responses; custom mappers can
override those responses by returning a response first.

The tested compatibility baseline is Next.js 15.5.23 and 16.3.1. See the
repository [English runtime and troubleshooting guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/troubleshooting.md)
or [简体中文问题排查指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/troubleshooting.md) for
the upgrade boundary and the [release notes](https://github.com/tech-zjf/next-route-kit/blob/main/docs/release/v0.1.0.md) for
the 0.1.0 public contract.

Next.js 15 and later expose dynamic route `params` asynchronously. The exported
Route Handler type keeps that Promise-based signature for Next's build-time
checks, while direct one-argument calls remain supported in tests and adapters.

`input` can be a direct value, a resolver function, a single `InputSource`, or an
object composed from input sources. The built-in sources are `jsonBody()` (with
`body()` as its short alias), `textBody()`, `query()`, `params()`, and
`headers()`. Use `defineInputSource()` for application-specific sources; input
validation remains an optional concern implemented by Input Pipes or adapters.
Input Pipes receive the source metadata through their `metadata` argument;
composed input maps expose field-level metadata under `metadata.fields`.
