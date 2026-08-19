# Next.js Compatibility Matrix

This document records real fixture builds rather than only TypeScript
compatibility. The fixtures live under `apps/` and consume the local
`next-route-kit` package through the workspace boundary.

## Current matrix

| Fixture               | Locked Next.js version | Node route | Edge route | Async params | Auth/resource chain |
| --------------------- | ---------------------: | :--------: | :--------: | :----------: | :-----------------: |
| `apps/next15-fixture` |                15.5.23 |    pass    |    pass    |     pass     |        pass         |
| `apps/next16-fixture` |                 16.3.1 |    pass    |    pass    |     pass     |        pass         |

The package-only CI surface is also checked on Node.js `18.18.0`, `20`, `22`,
and `24`. This matrix intentionally excludes the Next.js fixtures because the
framework versions have their own Node.js support ranges; the fixture matrix
continues to run on the repository's primary Node.js 22 validation runtime.

Each fixture contains:

- `/api/node` with `runtime = 'nodejs'`;
- `/api/edge` with `runtime = 'edge'`;
- `/api/params/[id]` with Promise-based dynamic params;
- `POST /api/echo` with `jsonBody()`;
- `POST /api/tenants/[tenantId]/resources` with a shared request-ID Middleware,
  authentication Guard, input validation Pipe, response Interceptor, and
  ExceptionFilter;
- query input on the Node and Edge routes.

The resource route is deliberately a user-shaped integration scenario rather than
a synthetic `createRoute()` smoke test. It verifies that a request can be
authenticated before a malformed body is read, that dynamic params and JSON
input reach the Handler as one typed object, that successful responses share an
envelope and request ID, and that validation failures have a stable error
contract.

Runtime-specific Factories can opt into static plugin diagnostics with
`createRoute({ runtime: 'edge', ... })` or `createRoute({ runtime: 'nodejs', ... })`.
The value should match the route module's Next.js `runtime` export. If omitted,
the Factory preserves compatibility with existing routes and does not assert
plugin metadata.

Next.js 15 introduced asynchronous Route Handler `params`; the fixture follows
the official Route Handler contract. See the [Next.js 15 Route Handler
reference](https://nextjs.org/docs/15/app/api-reference/file-conventions/route).
Next.js 16 continues the asynchronous-only request API model; see the [Next.js
16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

## Verification commands

From the repository root:

```bash
pnpm typecheck
pnpm build
pnpm verify:next:prod
pnpm verify:next:dev
```

The root build includes both fixture apps. To build one fixture only:

```bash
pnpm --filter @next-route-kit/fixture-next15 build
pnpm --filter @next-route-kit/fixture-next16 build
```

The smoke test routes can be exercised after starting a fixture:

```bash
pnpm --filter @next-route-kit/fixture-next15 exec next start -p 3115
curl http://127.0.0.1:3115/api/node?mode=test
curl http://127.0.0.1:3115/api/edge?mode=test
curl http://127.0.0.1:3115/api/params/sample-id
curl -X POST http://127.0.0.1:3115/api/echo \
    -H 'content-type: application/json' \
    --data '{"message":"hello"}'
curl -X POST 'http://127.0.0.1:3115/api/tenants/tenant-demo/resources?preview=true' \
    -H 'authorization: Bearer fixture-token' \
    -H 'content-type: application/json' \
    -H 'x-request-id: manual-resource' \
    --data '{"label":"sample","size":2}'
```

Replace the filter and port with `fixture-next16` and `3116` for the Next.js 16
fixture.

`pnpm verify:next:prod` builds both fixtures, starts them with `next start`, and
checks the Node, Edge, params, echo, and authenticated resource routes. The
development command starts both fixtures with `next dev --turbopack` and checks
the same user-shaped route set. Production and development servers are
intentionally verified as separate compatibility signals.

## Packed consumer boundary

The published package boundary is checked separately from workspace imports:

```bash
pnpm verify:packed
```

The check packs `@next-route-kit/core`, `next-route-kit`,
`@next-route-kit/zod`, and `@next-route-kit/testing`, installs the tarballs plus
a Zod peer tarball in a temporary consumer outside the monorepo, type-checks
real imports, executes successful and invalid requests through
`@next-route-kit/testing`, and verifies the runtime and type `exports` entries.
Until the paired packages are published to a registry, the temporary consumer
uses local pnpm overrides for the paired Core and main adapter tarballs; the
consumer itself has no workspace dependency.

## Known warnings

- Next.js 16.3.1 currently emits an Edge Runtime deprecation warning during
  build. The Edge route still builds and serves successfully; the project will
  revisit this fixture when Next changes the supported runtime contract.
- Next.js 15.5.23 emits a warning that the minimal fixture does not load the
  Next ESLint plugin. Repository linting still runs through the root ESLint
  Flat Config, and the fixture build succeeds.

These warnings are recorded rather than hidden so a future Next upgrade can
distinguish a framework warning from a `next-route-kit` regression.
