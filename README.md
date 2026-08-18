# next-route-kit

[![CI](https://github.com/tech-zjf/next-route-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/tech-zjf/next-route-kit/actions/workflows/ci.yml)

Composable infrastructure for Next.js App Router Route Handlers.

`next-route-kit` keeps the native `app/**/route.ts` convention and adds a typed, pluggable request pipeline for cross-cutting concerns such as authentication, input validation, tracing, error mapping, and response serialization.

The public entrypoint is a class-backed immutable Factory. The callable surface
is intentionally short, while plugin installation, scope derivation, and
pipeline compilation remain owned by `Factory` objects.

## Project status

The repository is in active implementation. The framework-neutral Core pipeline
and the first immutable Route Factory are available in the workspace; the Next.js
compatibility fixtures and optional validation adapters are still being built.

See:

- [Technical proposal](docs/architecture/technical-proposal.md)
- [Implementation plan](docs/implementation/implementation-plan.md)
- [Project status](docs/status/project-status.md)
- [Architecture decisions](docs/architecture/decisions/)

## Intended usage

```ts
// src/server/routes/index.ts
import { createRoute, jsonResponse } from 'next-route-kit'

type RequestState = {
    requestId: string
}

export const route = createRoute<RequestState>({
    plugins: [requestId(), requestLogger()],
    response: jsonResponse(),
    errorMappers: [httpErrorMapper(), defaultErrorMapper()],
})
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

The project does not introduce controllers, modules, decorators, dependency injection, runtime route scanning, or a replacement router.

## Project links

- Repository: <https://github.com/tech-zjf/next-route-kit>
- Issues and feature requests: <https://github.com/tech-zjf/next-route-kit/issues>
- Maintainer: [tech-zjf](https://github.com/tech-zjf)

## License

MIT.
