# ADR-0003: Public naming and package identity

- Status: accepted provisionally
- Date: 2026-08-17

## Context

The original name `next-route-infra` is descriptive but long and uses `infra`, which is broad and not especially memorable for application developers. The project also uses terms inspired by NestJS, but not every Next.js developer will share NestJS terminology.

## Decision

Use the project and primary package name:

```text
next-route-kit
```

Proposed package layout:

```text
next-route-kit              # recommended user-facing package
@next-route-kit/core        # advanced/plugin author contracts
@next-route-kit/zod         # optional Zod adapter
@next-route-kit/testing     # test helpers
```

`next-route-kit` communicates a toolkit rather than a replacement router or a full backend framework. The exact npm and GitHub name must be checked before the first publish. A read-only npm registry check on 2026-08-18 found no published versions for the four proposed package names; this does not establish ownership of the scoped name, so the release checklist still requires confirming `@next-route-kit` scope access before publishing.

## Public terminology

| Concept                         | Public name                           | Reason                                                         |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Route Handler wrapper           | `createRoute`                         | Directly describes the operation                               |
| Configured Factory              | `createRoute`                         | Short, direct, and returns a reusable `route(options)` Factory |
| Optional config helper          | `defineRouteConfig`                   | Optional type-safety helper; not required for basic usage      |
| Request context                 | `RouteContext`                        | Common server-framework term                                   |
| Middleware                      | `RouteMiddleware` / `use`             | Avoids confusion with Next `middleware.ts` and `proxy.ts`      |
| Authorization                   | `Guard`                               | Recognizable and precise for admission checks                  |
| Input validation/transformation | `input`, `validateBody`, `parseQuery` | User-facing API avoids requiring NestJS knowledge              |
| Advanced input stage            | `InputPipe`                           | Retained for plugin authors and NestJS familiarity             |
| Around behavior                 | `Interceptor`                         | Accurate for before/after execution                            |
| Exception conversion            | `ErrorMapper`                         | More precise than a generic `ErrorHandler`                     |
| Data-to-Response conversion     | `ResponseSerializer`                  | More precise than `ResponseWriter` for normal JSON responses   |
| Extensible capability           | `RoutePlugin`                         | Standard ecosystem term                                        |
| Child configuration             | `extend`                              | Familiar immutable composition model                           |

## Rejected names

### `next-route-infra`

Rejected as the public brand because it is long and infrastructure-oriented.

### `next-route-compose`

Rejected because an existing package already uses that name and describes composable Next.js Route Handler utilities.

### `next-middleware-*`

Rejected because Next.js 16 uses `proxy.ts` for its network boundary, and the package is not a replacement for that file convention.

### `next-router-*`

Rejected because the project does not implement route matching or replace the Next.js Router.
