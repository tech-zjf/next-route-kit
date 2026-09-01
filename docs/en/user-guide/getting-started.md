# Getting started

**English** · [简体中文](../../zh-CN/user-guide/getting-started.md)

## Install

```bash
npm install next-route-kit
```

The package targets Next.js App Router Route Handlers and Node.js `>=18.18.0`.

## Create a base Factory

```ts
// src/server/routes.ts
import { createRoute, jsonResponse } from 'next-route-kit'

export const route = createRoute({
    response: jsonResponse(),
})
```

Import this application-owned module from Route Handlers. No
`next.config.ts` registration is needed.

## Write a detail route

```ts
// app/api/resources/[id]/route.ts
import { route } from '@/src/server/routes'

type ResourceParams = { id: string }

export const GET = route<ResourceParams>({
    handler: async (request, { params }) => {
        const resource = await resourceService.find(params.id)
        return resource ?? new Response(null, { status: 404 })
    },
})
```

The first argument is the native `Request`. Next dynamic params are hydrated
before middleware and exposed as `context.params`.

## Add an authenticated scope

```ts
import { unauthorized } from 'next-route-kit'

const authenticatedRoute = route.withLocals({
    name: 'authentication',
    provide(context) {
        if (context.request.headers.get('authorization') !== 'Bearer sample-token') {
            throw unauthorized()
        }

        return { userId: 'viewer-demo' }
    },
})
```

The provider's actual output is inferred into every downstream Handler's locals,
so there is no separate optional `userId` declaration or type assertion. Keep a
plain Guard for authorization checks that do not establish new locals.

## Add body or query only when needed

```ts
import { jsonBody, query } from 'next-route-kit'

type CreateResource = { title: string }
type CreateQuery = { publish?: string }

export const POST = authenticatedRoute({
    body: jsonBody<CreateResource>(),
    query: query<CreateQuery>(),
    handler: async (_request, { body, query: values, locals }) =>
        resourceService.create({
            userId: locals.userId,
            title: body.title,
            publish: values.publish === 'true',
        }),
})
```

A list route can use `new URL(request.url)` directly. Params are in the
context and headers are on `request.headers`; neither needs an empty helper
declaration.

## Return values

Plain values use the default JSON serializer. Return a native `Response` for a
stream, file, redirect, explicit status, or `204` response.

Continue with the [API reference](api-reference.md).
