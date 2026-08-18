# next-route-kit user guide

**English** · [简体中文](../zh-CN/README.md)

`next-route-kit` wraps native Next.js App Router Route Handlers with an
explicit, typed request pipeline. It does not replace `app/**/route.ts`, the
Next.js Router, `next.config.ts`, or `proxy.ts`.

## Install

```bash
pnpm add next-route-kit
```

Optional packages:

```bash
pnpm add @next-route-kit/zod zod
pnpm add -D @next-route-kit/testing
```

## Start here

- [Why use next-route-kit?](./user-guide/why-route-kit.md)
- [Getting started](./user-guide/getting-started.md)
- [Configuration and scopes](./user-guide/configuration.md)
- [API reference](./user-guide/api-reference.md)
- [Input sources and validation](./user-guide/input-and-validation.md)
- [Pipeline, errors, and responses](./user-guide/pipeline-and-errors.md)
- [Writing plugins](./user-guide/plugins.md)
- [Migrating existing Route Handlers](./user-guide/migration.md)
- [Testing](./user-guide/testing.md)
- [Troubleshooting](./user-guide/troubleshooting.md)

## The basic model

Create one or more application-owned Factories and import the appropriate
Factory from each Route Handler:

```ts
// src/server/routes/index.ts
import { createRoute } from 'next-route-kit'

export const route = createRoute()
```

```ts
// app/api/health/route.ts
import { route } from '@/src/server/routes'

export const GET = route({
    handler: () => ({ ok: true }),
})
```

The default serializer converts ordinary return values to JSON and passes a
native `Response` through unchanged.

## User documentation versus maintainer documentation

This directory contains end-user documentation. Architecture decisions,
implementation tracking, compatibility evidence, and release operations are
maintainer documentation in the repository's [development documentation
index](../development/README.md).

## Version and compatibility

The current public baseline is `0.1.0`. It is verified against Next.js
15.5.23 and 16.3.1, including Node and Edge Route Handlers. See the
[compatibility matrix](../compatibility/next-matrix.md), [troubleshooting
guide](./user-guide/troubleshooting.md), and [release notes](../release/v0.1.0.md)
for the exact boundary.
