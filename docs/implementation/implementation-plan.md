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
- Nest-style middleware/guard/input/interceptor/handler lifecycle;
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

Lifecycle correction evidence (2026-08-18): Next route params are hydrated as
framework context before middleware and guards; route input preparation now runs
after middleware and guards, so denied requests do not resolve input or consume
the body. Input pipes run before interceptors, matching the public Route Factory
lifecycle contract. The Next adapter maps malformed JSON and `HttpError` values
through its default error mapper.

## Phase 4 — Next.js adapter and Route Factory

Status: `completed`

Deliverables:

- `createRoute(config)` as the configured Route Factory constructor;
- the returned `route(options)` function for individual Route Handlers;
- Next Route Handler signature adapter;
- `params: Promise<...>` support;
- catch-all parameter support;
- `NextRequest` / `NextResponse` compatibility;
- standard `jsonBody` / `textBody` / `query` / `params` / `headers` input sources;
- input source metadata for validator and schema adapters;
- Next.js 15 and Next.js 16 Node/Edge compatibility fixtures;
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
reserved query keys safely, and immutable input source metadata is available to
Input Pipes. The Next 15/16 fixture apps now cover Node and Edge routes,
asynchronous params, query input, and JSON body input.

Checkpoint evidence (2026-08-18): the Core suite has 17 passing tests and the
Next adapter suite has 25 passing tests. `pnpm typecheck`, `pnpm build`, the
Prettier check, and both package pack manifests pass. The packed Next package
rewrites the workspace Core dependency to the publishable `0.1.0` version. The
Next 15.5.23 and Next 16.3.1 fixtures build successfully and their Node/Edge,
params, query, and body routes return HTTP 200 in local smoke tests.

Exit criteria:

- a minimal Next.js fixture can export `GET` and `POST` through the Factory;
- the same factory applies global configuration to every route that imports it;
- direct `Response` passthrough works;
- request body is parsed once;
- plain JSON results receive the configured response policy.

Exit evidence (2026-08-18): Next.js 15.5.23 and 16.3.1 fixture apps build and
serve the Node/Edge, async params, query, and JSON body routes through the
public Factory API. The Next 15 build-time checker and Next 16 generated route
types both accept the Promise-based Handler context.

## Phase 5 — Scope configuration

Status: `completed`

Deliverables:

- `route.extend()`;
- global → scope → route merge rules;
- inherited security components are mandatory by construction;
- response serializer replacement rules;
- explicit no-opt-out policy for the 0.1.0 release;
- public examples for public, authenticated, admin, and internal routes.

Exit criteria:

- no route example repeats global middleware or error configuration;
- scope order is covered by tests;
- security-critical global plugins cannot be accidentally disabled;
- directory organization is documented as explicit Factory composition, not runtime scanning.

## Phase 6 — Official adapters and testing package

Status: `completed`

Deliverables:

- `@next-route-kit/zod`;
- `@next-route-kit/testing`;
- request builder;
- response assertions;
- plugin test helpers;
- body, query, params, and headers validation examples.

Checkpoint evidence (2026-08-18): `@next-route-kit/zod` is implemented as an
independent adapter. It provides the class-backed `ZodInputPipe` and
`ZodErrorMapper`, declares Zod as a peer dependency, supports async parsing,
and exposes stable validation issue output without adding Zod to Core.
`@next-route-kit/testing` is implemented as an independent runner-neutral
package with the immutable `RequestBuilder`, direct `invokeRoute()` helper,
cached `ResponseAssertions`, and `TestPlugin` double. Its README and tests
cover JSON body, query, headers, params, response assertions, and plugin
installation. The packed external consumer validates all four public package
boundaries, type exports, a successful request, and a 400 validation response.

Exit criteria:

- Zod is an optional peer dependency;
- core remains validator-agnostic;
- package fixtures install from packed artifacts;
- type inference is verified in consumer projects;
- testing helpers do not impose Vitest, Jest, or another test-runner dependency.

## Phase 7 — Compatibility matrix

Status: `in_progress`

Target fixtures:

- Next.js 15 + Node.js Route Handler;
- Next.js 15 + Edge-compatible core;
- Next.js 16 + Node.js Route Handler;
- Next.js 16 + Edge-compatible core;
- Turbopack development and production builds.

Progress (2026-08-18): the Next 15/16 Node and Edge production fixtures are
implemented and pass local HTTP smoke tests. A two-job GitHub Actions matrix
now builds each fixture and runs the same smoke checks. `pnpm verify:packed`
also installs the public package tarballs in a temporary external consumer,
runs typed Route Handler and validation smoke tests, and verifies package
exports. `RoutePluginRegistry` and the Route Factory now fail early with
`RuntimeIncompatiblePluginError` when a configured runtime conflicts with a
plugin declaration; the configured runtime is also exposed in route metadata.
`pnpm verify:next:prod` and `pnpm verify:next:dev` now exercise the same
user-shaped authenticated order route in production and Turbopack development
servers, including unauthorized and validation-error cases. Remote CI
execution remains outstanding until the release commit is pushed.

Exit criteria:

- all supported fixtures build;
- Route Handler behavior is covered by integration tests for a real business
  flow, not only a bare default Factory;
- Runtime-incompatible plugins fail with a clear diagnostic;
- package exports do not pull Node-only code into Edge fixtures.

## Phase 8 — Documentation and release

Status: `completed`

Deliverables:

- README quick start;
- migration guide from handwritten Route Handlers;
- plugin authoring guide;
- Runtime guide;
- error and response guide;
- compatibility policy;
- English and Simplified Chinese user guides with API reference;
- release checklist and English/Chinese 0.1.0 release notes;
- npm package file allowlists and tarball boundary verification;
- Changesets configuration and protected Release workflow.

Exit criteria:

- a new user can create a configured Route Factory with `const route = createRoute({ ...config })` without reading source code;
- a plugin author can depend only on public contracts;
- a packed package works outside the monorepo;
- all local release checks pass;
- the protected Release workflow can publish only after explicit confirmation.

Exit evidence (2026-08-18): the bilingual public user guides, API reference,
0.1.0 release notes, release checklist, Changesets baseline marker, package
release scripts, explicit npm file allowlists, tarball boundary verifier, and
manual protected Release workflow are implemented. Local release checks pass;
remote CI and npm publication remain external steps that require the
maintainer's commit, credentials, and approval.

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
