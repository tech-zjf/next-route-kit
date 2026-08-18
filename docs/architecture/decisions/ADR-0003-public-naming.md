# ADR-0003: Public naming and package identity

- Status: accepted provisionally
- Date: 2026-08-17

## Context

The earlier infrastructure-oriented name was descriptive but long and not especially memorable for application developers. The public API should use terms that describe the responsibility directly and avoid framework-specific ceremony.

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

| Concept                         | Public name                                          | Reason                                                        |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Factory constructor             | `createRoute`                                        | Directly describes creation of a reusable Route Factory       |
| Configured Factory              | `Factory` / callable `route`                         | Class ownership with a short Route Handler syntax             |
| Request-local shared values     | `locals`                                             | Clearer than the overloaded `state` term                      |
| Route input                     | `body`, `query`, native `request`                    | Optional named values without forcing an input wrapper        |
| Input source helper             | `jsonBody`, `textBody`, `query`, `defineInputSource` | Describes where a value comes from                            |
| Input validation/transformation | `Pipe` / `transform`                                 | Familiar server-pipeline term and precise responsibility      |
| Request admission               | `Guard` / `canActivate`                              | Recognizable and precise for authentication and authorization |
| Around behavior                 | `Interceptor` / `intercept`                          | Accurate for before/after execution                           |
| Exception conversion            | `ExceptionFilter` / `catch`                          | Matches the failure boundary and avoids vague error mapping   |
| Data-to-Response conversion     | `ResponseSerializer`                                 | Precise for normal JSON responses                             |
| Extensible capability           | `RoutePlugin`                                        | Standard ecosystem term                                       |
| Child configuration             | `extend`                                             | Familiar immutable composition model                          |

## Rejected names

### Earlier infrastructure-oriented name

Rejected as the public brand because it was long and infrastructure-oriented.

### `next-route-compose`

Rejected because an existing package already uses that name and describes composable Next.js Route Handler utilities.

### `next-middleware-*`

Rejected because Next.js 16 uses `proxy.ts` for its network boundary, and the package is not a replacement for that file convention.

### `next-router-*`

Rejected because the project does not implement route matching or replace the Next.js Router.
