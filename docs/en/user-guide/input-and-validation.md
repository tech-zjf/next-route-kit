# Input and validation

**English** · [简体中文](../../zh-CN/user-guide/input-and-validation.md)

Parsing is opt-in. Use a resolver only when a typed, shared value makes the
route easier to read.

## Body

```ts
export const POST = route({
    body: jsonBody<CreateInput>(),
    handler: async (_request, { body }) => service.create(body),
})
```

Use `textBody()` for text. If raw access is clearer, omit `body` and call
`request.text()` or `request.json()` yourself. Body parsing is lazy and
cached; Guards run first. When `body` is declared, use the named `body` value in
the handler because the underlying Request stream may already have been
consumed.

Automatic body resolvers read at most 1 MiB by default. A Factory or route can
set a lower `maxBodyBytes`; a child scope cannot relax its inherited limit. Use
a separate Factory when a JSON domain needs a larger explicit limit:

```ts
const largeJsonRoute = createRoute({ maxBodyBytes: 5 * 1024 * 1024 })
```

Keep streams, multipart requests, and uploads on native Handlers instead of the
automatic body resolver.

## Schema-bound body and query

When the application uses Zod, prefer one declaration that parses, validates,
transforms, and infers the Handler type:

```ts
import { z } from 'zod'
import { zodBody, zodQuery } from '@next-route-kit/zod'

const bodySchema = z.object({ count: z.coerce.number().int().positive() })
const querySchema = z.object({ preview: z.enum(['true', 'false']).optional() })

export const POST = route({
    body: zodBody(bodySchema),
    query: zodQuery(querySchema),
    handler: (_request, { body, query }) => service.create(body.count, query.preview),
})
```

Keep `zodPipe()` for Factory-wide validation, advanced transformations across
multiple sources, and projects that already use `jsonBody()` or custom sources.

## Query

```ts
type ListQuery = { search?: string; page?: string }

export const GET = route({
    query: query<ListQuery>(),
    handler: (_request, { query: values }) => service.list(values),
})
```

Repeated keys become read-only arrays. For a one-off query, use
`new URL(request.url).searchParams` instead.

## Params and headers

```ts
export const GET = route<{ id: string }>({
    handler: (request, { params }) => ({
        id: params.id,
        authorization: request.headers.get('authorization'),
    }),
})
```

Params and headers do not need helper declarations in normal routes. Read them
from the named context and native request shown above.

## Custom sources

```ts
const tenantBody = defineInputSource('tenant-body', 'body', ({ readBody }) => {
    return readBody<{ tenantId: string }>()
})

export const POST = route({
    body: tenantBody,
    handler: (_request, { body }) => ({ tenantId: body.tenantId }),
})
```

A custom source can be assigned to the route's `body` or `query` option when
that source is reused and the named handler context is clearer. For one-off
headers, use `request.headers` directly.

## Pipes

Pipes receive each declared argument separately:

```ts
const validateBody: Pipe = {
    name: 'validate-body',
    transform(value, metadata) {
        if (metadata.type !== 'body') return value
        return validate(value)
    },
}

const route = createRoute({ pipes: [validateBody] })
```

Core stays validator-agnostic. The optional `@next-route-kit/zod` package provides
`zodBody()`, `zodQuery()`, `zodPipe()`, and, for non-envelope routes,
`zodExceptionFilter()`. If the route
uses `apiResponsePlugin()`, map `ZodValidationError` through its optional
`mapError` callback instead so validation errors keep the `{ code, msg, data }`
contract. Use `appliesTo` when a scope has both body and query schemas.

The Zod adapter exposes only normalized `code`, `message`, and `path` issue
fields. It does not retain rejected input by default because bodies and queries
may contain secrets or personal data. `captureInput: true` is an explicit
debugging opt-in and should not be enabled for production request logging.
