# next-route-kit

[![CI](https://github.com/tech-zjf/next-route-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/tech-zjf/next-route-kit/actions/workflows/ci.yml)

Composable infrastructure for Next.js App Router Route Handlers.

`next-route-kit` keeps the native `app/**/route.ts` convention and adds a typed, pluggable request pipeline for cross-cutting concerns such as authentication, input validation, tracing, error mapping, and response serialization.

The practical use case is a real API surface: define request ID and response
policy once, derive an authenticated scope, validate order or account input in
a Pipe, and leave each Route Handler with only its business operation. The
[why route kit guide](docs/en/user-guide/why-route-kit.md) shows the duplicated
Route Handler version and the shared Factory version side by side.

The public entrypoint is a class-backed immutable Factory. The callable surface
is intentionally short, while plugin installation, scope derivation, and
pipeline compilation remain owned by `Factory` objects.

## Project status

The first public release baseline is `0.1.0`. The framework-neutral Core
pipeline, immutable Route Factory, optional Zod validation adapter, and
framework-neutral testing helpers are available as publishable packages. Real
Next.js 15/16 compatibility fixtures build and pass Route Handler smoke tests.

User documentation:

- [English user guide](docs/en/README.md)
- [简体中文用户指南](docs/zh-CN/README.md)
- [Documentation index](docs/README.md)

Maintainer documentation:

- [Development documentation](docs/development/README.md)
- [Release documentation](docs/release/)

Package documentation:

- [Zod adapter](packages/zod/README.md)
- [Testing helpers](packages/testing/README.md)

## Intended usage

Install the main package in an existing Next.js 15+ App Router application:

```bash
pnpm add next-route-kit
```

```ts
// src/server/routes/index.ts
import { createRoute, jsonResponse, type AnyRouteContext } from 'next-route-kit'
import { requireUser } from './security'

type RequestState = {
    requestId: string
}

const requestIdMiddleware = {
    name: 'request-id',
    handle(context: AnyRouteContext<RequestState>, next: () => Promise<unknown>) {
        context.state.requestId = crypto.randomUUID()
        return next()
    },
}

export const route = createRoute<RequestState>({
    middleware: [requestIdMiddleware],
    response: jsonResponse(),
})

export const authenticatedRoute = route.extend({
    guards: [requireUser()],
})
```

For a runtime-specific Factory, keep the explicit package setting aligned with
Next.js's route-module export. This enables early diagnostics for Node-only
plugins accidentally composed into an Edge route:

```ts
export const runtime = 'edge'
export const route = createRoute({ runtime: 'edge', plugins: [edgeTracing()] })
```

```ts
// app/api/users/route.ts
import { route } from '@/server/routes'

export const GET = route({
    handler: async ({ state }) => {
        return userService.list({ requestId: state.requestId })
    },
})
```

The public request lifecycle is:

```text
Next params hydration → Middleware → Guard → Input Resolver → Input Pipe
→ Interceptor → Handler → Response Serializer
```

See the [English real user scenario](docs/en/user-guide/why-route-kit.md) or
[简体中文真实用户场景](docs/zh-CN/user-guide/why-route-kit.md) for the concrete
before/after comparison. Then read the [English quick start](docs/en/user-guide/getting-started.md) or the
[简体中文快速开始](docs/zh-CN/user-guide/getting-started.md) for a complete route and the
[0.1.0 release notes](docs/release/v0.1.0.md) for the supported contract.

The project does not introduce controllers, modules, decorators, dependency injection, runtime route scanning, or a replacement router.

## Verification

The packed-package boundary can be checked locally with:

```bash
pnpm verify:packed
```

The full release gate is:

```bash
pnpm release:check
```

Publishing is intentionally manual and protected. See the
[release checklist](docs/release/release-checklist.md).

This builds the public packages, installs their tarballs in a temporary
consumer outside the workspace, type-checks the consumer, and runs Route
Handler plus validation smoke tests through the public testing helpers.

## Project links

- Repository: <https://github.com/tech-zjf/next-route-kit>
- Issues and feature requests: <https://github.com/tech-zjf/next-route-kit/issues>
- Maintainer: [tech-zjf](https://github.com/tech-zjf)

## License

MIT.
