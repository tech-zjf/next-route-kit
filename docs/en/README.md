# next-route-kit user guide

**English** · [简体中文](../zh-CN/README.md)

This is the user-facing documentation. The root README is the short overview;
architecture and release material live under docs/architecture and docs/release.

## Install

```bash
npm install next-route-kit
npm install @next-route-kit/zod zod       # optional
npm install -D @next-route-kit/testing    # optional
```

## Start here

- [Why use it?](user-guide/why-route-kit.md)
- [Getting started](user-guide/getting-started.md)
- [Configuration and scopes](user-guide/configuration.md)
- [Stable API response contracts](user-guide/api-response.md)
- [API reference](user-guide/api-reference.md)
- [Input and validation](user-guide/input-and-validation.md)
- [Pipeline and errors](user-guide/pipeline-and-errors.md)
- [Plugins](user-guide/plugins.md)
- [Testing](user-guide/testing.md)
- [Migration](user-guide/migration.md)
- [Troubleshooting](user-guide/troubleshooting.md)

## Production adoption and compatibility feedback

The package is built for production App Router projects with repeated
authentication, validation, error mapping, or response-envelope policy. Start
with one representative Route Handler and extend the shared Factory as the
pattern proves useful.

For a migration or compatibility report, include your Next.js version, runtime,
migrated route shape, and the relevant API or documentation area. Use the
[compatibility and migration issue form](https://github.com/tech-zjf/next-route-kit/issues/new/choose);
these reports directly improve the compatibility matrix and public API.

## The basic model

```ts
import { createRoute } from 'next-route-kit'

const route = createRoute()

export const GET = route({
    handler: (request, { params, locals }) => ({
        method: request.method,
        params,
        locals,
    }),
})
```

The exported value is a normal Next-compatible Route Handler. Factory scopes are
explicit imports; there is no filesystem scan or `next.config.ts` registration.
