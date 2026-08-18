# Implementation Plan

This document is the execution checklist for `next-route-kit`. It is intentionally more operational than the technical proposal. The status of each phase must be updated as work progresses.

## Status legend

- `pending`: not started
- `in_progress`: actively being implemented
- `blocked`: cannot proceed without a new decision or external change
- `completed`: exit criteria have been verified

## Phase 0 — Architecture baseline

Status: `completed`

Deliverables:

- architecture audit;
- public naming decision;
- Runtime boundary decision;
- global configuration design;
- technical proposal;
- ADRs and status log.

Exit criteria:

- no unresolved structural contradiction in the MVP architecture;
- Next.js-specific behavior isolated behind an adapter boundary;
- implementation steps are independently verifiable.

## Phase 1 — Repository bootstrap

Status: `completed`

Deliverables:

- pnpm workspace;
- Turborepo task graph;
- TypeScript project references or equivalent package-level builds;
- Vitest configuration;
- Changesets configuration;
- ESLint, Prettier, Husky, and lint-staged configuration;
- MIT license;
- package metadata for `next-route-kit` and `@next-route-kit/core`.

Exit criteria:

- a clean install succeeds;
- all packages type-check;
- an empty test suite runs;
- `npm pack` can produce a package artifact;
- no package imports application code.

Checkpoint evidence (2026-08-18): the workspace install completed, both public
packages type-check and build, both package tarballs pass `npm pack --dry-run`,
the Vitest suites run successfully, and the root ESLint configuration validates
the TypeScript source. Husky's `pre-commit` hook delegates staged-file
formatting and linting to `lint-staged`.

## Phase 2 — Core contracts

Status: `completed`

Deliverables:

- `RouteContext`;
- `RouteMiddleware`;
- `Guard`;
- `InputPipe`;
- `Interceptor`;
- `ErrorMapper`;
- `ResponseSerializer`;
- `RoutePlugin`;
- `RoutePluginRegistry`;
- `RouteConfig`;
- `HttpError`.

Exit criteria:

- core has no Next.js import;
- contracts use Web APIs or framework-neutral types;
- public types compile under strict TypeScript;
- type tests cover state extension and plugin capabilities.

Checkpoint evidence (2026-08-17): `@next-route-kit/core` exposes the context,
pipeline component, plugin, registry, config, and error contracts under strict TypeScript;
the package has no Next.js import and its public declarations are emitted from
the package build.

## Phase 3 — Core pipeline runtime

Status: `completed`

Deliverables:

- deterministic stage composition;
- middleware short-circuiting;
- guard short-circuiting;
- pipe transformation;
- interceptor onion execution;
- error mapper resolution;
- response serialization boundary.

Exit criteria:

- stage order is covered by unit tests;
- errors from every stage reach the configured error mappers;
- a native `Response` is never serialized twice;
- plugin order is stable and documented.

Checkpoint evidence (2026-08-18): Core tests cover the stage order, middleware
result transformation, guard short-circuiting, pipe transformation, request
preparation error mapping, native Response passthrough, and the missing
serializer boundary.

## Phase 4 — Next.js adapter and Route Factory

Status: `in_progress`

Deliverables:

- `createRoute(config)` as the configured Route Factory constructor;
- the returned `route(options)` function for individual Route Handlers;
- Next Route Handler signature adapter;
- `params: Promise<...>` support;
- catch-all parameter support;
- `NextRequest` / `NextResponse` compatibility;
- standard `jsonBody` / `textBody` / `query` / `params` / `headers` input sources;
- default JSON response serializer;
- one-time lazy body parsing.

Progress (2026-08-18): `createRoute({ ...config })`, the class-backed immutable
`Factory`, `extend()`, route-local configuration, Promise/object `params`
normalization, structural Request/Response compatibility, the Core
`RoutePluginRegistry`, plugin contribution installation, one-time lazy body
text/JSON reads for input resolvers, preparation-stage error mapping, immutable
callable shells, route-level response aliases, the default JSON serializer, and
standard body/query/header/params/text input source primitives are implemented.
Input source maps support mixed literal fields, compile-time shallow snapshots,
and reserved query keys safely. Next-version fixture validation remains
outstanding.

Checkpoint evidence (2026-08-18): the Core suite has 12 passing tests and the
Next adapter suite has 16 passing tests. `pnpm typecheck`, `pnpm build`, the
Prettier check, and both package pack manifests pass. The packed Next package
rewrites the workspace Core dependency to the publishable `0.1.0` version.

Exit criteria:

- a minimal Next.js fixture can export `GET` and `POST` through the Factory;
- the same factory applies global configuration to every route that imports it;
- direct `Response` passthrough works;
- request body is parsed once;
- plain JSON results receive the configured response policy.

## Phase 5 — Scope configuration

Status: `pending`

Deliverables:

- `route.extend()`;
- global → scope → route merge rules;
- mandatory plugin support;
- response serializer replacement rules;
- route-level opt-out rules where safe;
- public examples for public, authenticated, admin, and internal routes.

Exit criteria:

- no route example repeats global middleware or error configuration;
- scope order is covered by tests;
- security-critical global plugins cannot be accidentally disabled;
- directory organization is documented as explicit Factory composition, not runtime scanning.

## Phase 6 — Official adapters and testing package

Status: `pending`

Deliverables:

- `@next-route-kit/zod`;
- `@next-route-kit/testing`;
- request builder;
- response assertions;
- plugin test helpers;
- body, query, params, and headers validation examples.

Exit criteria:

- Zod is an optional peer dependency;
- core remains validator-agnostic;
- package fixtures install from packed artifacts;
- type inference is verified in consumer projects.

## Phase 7 — Compatibility matrix

Status: `pending`

Target fixtures:

- Next.js 15 + Node.js Route Handler;
- Next.js 15 + Edge-compatible core;
- Next.js 16 + Node.js Route Handler;
- Next.js 16 + Edge-compatible core;
- Turbopack development and production builds.

Exit criteria:

- all supported fixtures build;
- Route Handler behavior is covered by integration tests;
- Runtime-incompatible plugins fail with a clear diagnostic;
- package exports do not pull Node-only code into Edge fixtures.

## Phase 8 — Documentation and release candidate

Status: `pending`

Deliverables:

- README quick start;
- migration guide from handwritten Route Handlers;
- plugin authoring guide;
- Runtime guide;
- error and response guide;
- compatibility policy;
- release checklist;
- Changesets for all published packages.

Exit criteria:

- a new user can create a configured Route Factory with `const route = createRoute({ ...config })` without reading source code;
- a plugin author can depend only on public contracts;
- a packed package works outside the monorepo;
- all release checks pass.

## Checkpoint update template

Use this template in `docs/status/project-status.md` after each checkpoint:

```md
### YYYY-MM-DD — Phase N checkpoint

- Status:
- Changed:
- Verified:
- Decisions:
- Risks:
- Next:
```
