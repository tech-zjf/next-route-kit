# next-route-kit

The Next.js App Router entry package for `next-route-kit`.

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

`createRoute` is a class-backed root Factory. A configured Factory is explicit
and immutable. Use `route.extend({ ... })` to create a scope factory for a group
of routes. The returned function is a normal Next.js
Route Handler and can be exported as `GET`, `POST`, or another supported method.

`createRoute` does not scan files, replace the App Router, or require runtime
registration in `next.config.ts`.

`input` can be a direct value, a resolver function, a single `InputSource`, or an
object composed from input sources. The built-in sources are `jsonBody()` (with
`body()` as its short alias), `textBody()`, `query()`, `params()`, and
`headers()`. Use `defineInputSource()` for application-specific sources; input
validation remains an optional concern implemented by Input Pipes or adapters.
