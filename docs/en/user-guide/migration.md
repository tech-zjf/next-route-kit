# Migrating an existing Route Handler

**English** · [简体中文](../../zh-CN/user-guide/migration.md)

Migration is incremental. Existing native handlers do not need to change.

## Before

```ts
export async function POST(request: Request) {
    try {
        const user = await authenticate(request)
        const body = CreateSchema.parse(await request.json())
        const resource = await resourceService.create(user.id, body)

        return Response.json({ data: resource })
    } catch (error) {
        return mapApplicationError(error)
    }
}
```

## After

```ts
import { createRoute, jsonBody } from 'next-route-kit'

const apiRoute = createRoute({
    guards: [authenticationGuard],
    pipes: [validateCreateResource],
    exceptionFilters: [applicationErrorFilter],
})

export const POST = apiRoute({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body, locals }) => resourceService.create(locals.userId, body),
})
```

The example uses application-owned `authenticate`, `authenticationGuard`, `validateCreateResource`, and
`applicationErrorFilter` components. The package does not choose your auth,
schema library, response codes, or service layer for you.

## Move only repeated policy

1. Put request ID and logging in Middleware.
2. Put authentication and authorization in Guards and `extend()` scopes.
3. Put validation in Pipes or the optional Zod adapter.
4. Put response envelopes and timing in Interceptors.
5. Put application error conversion in ExceptionFilters.
6. Keep special native Request/Response flows native.

Do not migrate a route if the new scope does not make its business logic easier to
read.
