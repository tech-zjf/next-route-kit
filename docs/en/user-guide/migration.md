# Migrating an existing Route Handler

**English** · [简体中文](../../zh-CN/user-guide/migration.md)

Migration is incremental. Existing native handlers do not need to change.

## Before

```ts
export async function POST(request: Request) {
    const body = await request.json()
    return Response.json({ name: body.name })
}
```

## After

```ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

export const POST = route({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ name: body.name }),
})
```

## Move only repeated policy

1. Put request ID and logging in Middleware.
2. Put authentication and authorization in Guards and `extend()` scopes.
3. Put validation in Pipes or the optional Zod adapter.
4. Put response envelopes and timing in Interceptors.
5. Put application error conversion in ExceptionFilters.
6. Keep special native Request/Response flows native.

Do not migrate a route if the new scope does not make its business logic easier to
read.
