# Input sources and validation

[简体中文](../../zh-CN/user-guide/input-and-validation.md) · **English**

Input resolution is deliberately separate from validation. The main package
knows how to obtain Web request data; Input Pipes or optional adapters decide
whether the data is valid.

## Built-in input sources

```ts
import { body, headers, jsonBody, params, query, textBody } from 'next-route-kit'
```

| Source          | Value                                                   | Notes                                        |
| --------------- | ------------------------------------------------------- | -------------------------------------------- |
| `jsonBody<T>()` | `Promise<T>`                                            | Parses JSON lazily. `body<T>()` is an alias. |
| `textBody()`    | `Promise<string>`                                       | Reads the body as text.                      |
| `query()`       | `Readonly<Record<string, string \| readonly string[]>>` | Repeated keys become readonly arrays.        |
| `params<T>()`   | `T`                                                     | Reads the resolved dynamic route params.     |
| `headers()`     | `Headers`                                               | Returns a copy of the request headers.       |

## Compose an input object

```ts
const GET = route({
    input: {
        body: jsonBody<{ search: string }>(),
        query: query(),
        params: params<{ id: string }>(),
        headers: headers(),
        version: 'v1',
    },
    handler: ({ input }) => ({
        id: input.params.id,
        search: input.body.search,
        page: input.query.page,
        version: input.version,
    }),
})
```

Source maps may mix Input Sources and literal values. The object declaration is
shallow-snapshotted when the Route Handler is compiled, so mutating the source
map later does not silently change the exported handler.

## Custom input sources

Use `defineInputSource` when a source is reused by several routes:

```ts
import { defineInputSource } from 'next-route-kit'

const tenantId = defineInputSource('tenant-id', 'headers', ({ request }) => {
    const value = request.headers.get('x-tenant-id')

    if (!value) {
        throw new Error('Missing x-tenant-id')
    }

    return value
})

const route = createRoute()

export const GET = route({
    input: { tenantId },
    handler: ({ input }) => ({ tenantId: input.tenantId }),
})
```

The resolver receives:

```ts
type RouteInputContext = {
    request: Request
    params: RouteParams
    state: TState
    readBody<T>(): Promise<T>
    readText(): Promise<string>
}
```

`readBody()` and `readText()` share the request's one-shot body stream. Repeated
calls reuse the cached text or parsed JSON result. A Guard can reject a request
before either method is called.

## Resolver functions

For one-off logic, use a resolver instead of defining a named source:

```ts
const route = createRoute()

export const GET = route({
    input: async ({ request, params, state }) => ({
        url: request.url,
        id: params.id,
        userId: state.userId,
    }),
    handler: ({ input }) => input,
})
```

## Zod adapter

Install the optional adapter:

```bash
pnpm add @next-route-kit/zod zod
```

`zodPipe(schema)` runs after input resolution. It replaces the current input
with Zod's parsed output, so transforms and async refinements are supported.

```ts
import { z } from 'zod'
import { createRoute, jsonBody, query } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'

const bodySchema = z.object({ name: z.string().min(1) })
const querySchema = z.object({ page: z.coerce.number().int().positive().default(1) })

const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema, query: querySchema }))],
    errorMappers: [zodErrorMapper()],
})

export const POST = route({
    input: {
        body: jsonBody<z.input<typeof bodySchema>>(),
        query: query(),
    },
    handler: ({ input }) => ({
        name: input.body.name,
        page: input.query.page,
    }),
})
```

The mapper returns status `400`, code `VALIDATION_ERROR`, and an `issues` array
by default. Customize it with `{ status, code, message, headers, name }`.

Validation failures are mapped by the normal Error Mapper chain. Register the
mapper on the global Factory, a scope, or one route depending on the desired
boundary.
