# Getting started

[简体中文](../../zh-CN/user-guide/getting-started.md) · **English**

This guide uses the native Next.js App Router structure. No route file is
renamed and no registration is added to `next.config.ts`.

If you want to see the concrete problem this pipeline solves before starting,
read [Why use next-route-kit?](./why-route-kit.md).

## 1. Install the package

```bash
pnpm add next-route-kit
```

The application must already use the Next.js App Router and Route Handler
convention. The Next.js version and Node.js version should follow the
requirements of the Next.js version selected by the application.

The published packages are ESM packages, so use `import`/`export`. The package
baseline is Node.js `>=18.18.0`; a newer Next.js version may impose a newer Node
requirement of its own.

## 2. Create a shared Factory

Keep the Factory in an application-owned server module. The file name and
directory are conventions; `next-route-kit` does not scan them.

```ts
// src/server/routes/index.ts
import { createRoute, jsonResponse } from 'next-route-kit'

export const route = createRoute({
    response: jsonResponse(),
})
```

The Factory is immutable and callable. Calling `route(options)` compiles one
Route Handler. Calling `route.extend(config)` creates another immutable Factory
for a business scope.

## 3. Export a normal Route Handler

```ts
// app/api/users/route.ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

type CreateUserInput = {
    name: string
}

export const POST = route({
    input: jsonBody<CreateUserInput>(),
    handler: async ({ input }) => ({
        name: input.name,
    }),
})
```

The handler returns an object, so the default JSON serializer produces a JSON
response. It may also return a native `Response` when it needs full control:

```ts
export const DELETE = route({
    handler: () => new Response(null, { status: 204 }),
})
```

## 4. Read query, params, and headers

Input sources can be composed into a typed `input` object:

```ts
// app/api/users/[id]/route.ts
import { headers, params, query } from 'next-route-kit'
import { route } from '@/src/server/routes'

type UserParams = { id: string }

export const GET = route({
    input: {
        params: params<UserParams>(),
        query: query(),
        headers: headers(),
    },
    handler: ({ input }) => ({
        id: input.params.id,
        preview: input.query.preview,
        authorization: input.headers.get('authorization'),
    }),
})
```

Dynamic route params are hydrated by the adapter before Middleware and Guards
run. In the handler and input source, `params` is the resolved object; the
Next.js Route Handler's second argument remains Promise-based internally.

## 5. Add a business scope

Put shared policy in a scope Factory instead of repeating it in every route:

```ts
// src/server/routes/scopes.ts
import { route } from './index'
import { requireUser } from '../security/require-user'

export const authenticatedRoute = route.extend({
    guards: [requireUser],
})
```

```ts
// app/api/account/route.ts
import { authenticatedRoute } from '@/src/server/routes/scopes'

export const GET = authenticatedRoute({
    handler: ({ state }) => ({ userId: state.userId }),
})
```

See [configuration and scopes](./configuration.md) for merge order and the
security policy around inherited components.

## 6. Add validation when needed

Validation is optional. The Core and main package do not force a validation
library:

```bash
pnpm add @next-route-kit/zod zod
```

```ts
import { z } from 'zod'
import { createRoute, jsonBody } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'

const bodySchema = z.object({ name: z.string().min(1) })

const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema }))],
    errorMappers: [zodErrorMapper()],
})

export const POST = route({
    input: { body: jsonBody<z.input<typeof bodySchema>>() },
    handler: ({ input }) => ({ name: input.body.name }),
})
```

## Request lifecycle

The public order is fixed:

```text
Next params hydration
  → Middleware
  → Guard
  → Input Resolver
  → Input Pipe
  → Interceptor
  → Handler
  → Response Serializer
```

Guards can reject a request before a route body is read. Input Pipes transform
the resolved input before the handler. Error Mappers handle failures from the
entire pipeline.
