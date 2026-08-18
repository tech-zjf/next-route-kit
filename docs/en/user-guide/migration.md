# Migrating existing Route Handlers

[简体中文](../../zh-CN/user-guide/migration.md) · **English**

Migration is incremental. Existing `app/**/route.ts` files remain valid; only
routes that need shared behavior have to use a Factory.

## Before

```ts
export async function POST(request: Request) {
    const body = (await request.json()) as { name: string }
    return Response.json({ name: body.name })
}
```

## After

```ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

export const POST = route({
    input: jsonBody<{ name: string }>(),
    handler: ({ input }) => ({ name: input.name }),
})
```

## Move concerns in small steps

1. Create one application-owned Factory.
2. Move response serialization and error mapping into its configuration.
3. Move authentication into a Guard or an authenticated Scope Factory.
4. Move body, query, params, and headers extraction into `input` sources.
5. Add validation through an Input Pipe or optional adapter.
6. Keep raw `Response` returns for streams, downloads, and special status codes.

The package does not wrap or scan existing routes automatically. This explicit
boundary prevents a Next.js compiler upgrade from silently changing which routes
are protected.
