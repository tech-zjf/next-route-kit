# Project Status

Last updated: 2026-08-18

## Current state

```text
Phase: 4 - Next.js adapter and Route Factory
Status: in_progress
Implementation code: Core pipeline and Route Factory slice reviewed, corrected, and extended
Next step: add Next compatibility fixtures and input validation adapters
```

## Completed in this cycle

- Re-audited the original `next-route-infra` proposal.
- Confirmed the main architecture: Web API based core plus a thin Next.js adapter.
- Confirmed global configuration should use an explicit immutable Route Factory created by `createRoute()`.
- Rejected runtime plugin registration through `next.config.ts`.
- Defined global, scope, route, and handler configuration precedence.
- Added Next.js compatibility boundaries for `params`, `OPTIONS`, caching, and Runtime.
- Refined public terminology to avoid forcing NestJS-specific concepts on every user.
- Renamed the project working name to `next-route-kit`.
- Simplified the Factory API to `const route = createRoute({ ...config })`; a central `route-infra.config.ts` is optional rather than required.
- Added the technical proposal, implementation plan, and architecture decision records.
- Bootstrapped the pnpm/Turborepo workspace with Changesets, package builds, and test tooling.
- Implemented `@next-route-kit/core` contracts and deterministic pipeline runtime.
- Implemented the first `next-route-kit` Route Factory with immutable `extend()` scopes.
- Added default JSON serialization, plugin contribution installation, Promise/object params normalization, lazy one-shot body caching, and package-level smoke tests.
- Refactored the Route Factory and Core Pipeline into owned classes, keeping the functional pipeline call only as a compatibility facade.
- Added the Core `RoutePluginRegistry`; child scopes reuse parent plugin contributions and install only newly added plugins.
- Fixed `readBody()` to cache the parsed JSON promise as well as the underlying one-shot text stream.
- Fixed request preparation errors so params/input resolver failures reach the configured Error Mappers.
- Froze the callable Factory shell and snapshotted the route input definition at compilation time.
- Added route-level `response` alias support and corrected the README state/import example.
- Added composable `jsonBody`/`body`, `textBody`, `query`, `params`, `headers`, and
  `defineInputSource` primitives with typed source-map composition.
- Fixed mixed source/literal input maps, source-map compile-time snapshots, and
  reserved query keys; made `RoutePluginRegistry` instances runtime immutable.
- Added an explicit duplicate-response-serializer error so plugin conflicts do
  not silently select the first serializer.
- Added TypeScript-aware ESLint rules, Husky `pre-commit` integration, and
  `lint-staged` so Prettier and ESLint only process files included in the
  current commit.
- Moved package tests out of `src/` into package-level `tests/` directories and
  updated typecheck/build boundaries accordingly; published `src/` trees now
  contain production code only.

## Current decisions

| Decision                                                                                      | Status                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Preserve `app/**/route.ts`                                                                    | accepted                                            |
| Use `createRoute({ ...config })` as the Factory constructor                                   | accepted                                            |
| Allow the Factory/config module in any directory                                              | accepted                                            |
| Require a central `route-infra.config.ts` file                                                | rejected; optional convention only                  |
| Keep `next.config.ts` for build integration only                                              | accepted                                            |
| Keep `proxy.ts` outside the MVP                                                               | accepted                                            |
| Core package must not import Next.js                                                          | accepted                                            |
| Main package name: `next-route-kit`                                                           | provisional; registry check required before publish |
| Public input terminology should prefer `input` and validator helpers                          | accepted                                            |
| Public response terminology should prefer `ResponseSerializer`                                | accepted                                            |
| The first adapter slice uses Web API-compatible structural types and does not import `next`   | accepted                                            |
| Default JSON serialization belongs to `next-route-kit`; Core remains serializer-agnostic      | accepted                                            |
| Route Factory and Pipeline are class-backed; callable syntax is only an ergonomic Proxy shell | accepted                                            |
| Plugin installation belongs to an immutable Core `RoutePluginRegistry`                        | accepted                                            |

## Next implementation checkpoint

The next checkpoint is the remaining work in Phase 4:

1. Add Zod-independent input composition and validation metadata.
2. Add Next.js 15/16 fixture projects and compatibility checks.
3. Verify packed-package consumption outside the workspace.
4. Update this file with evidence and the next status.

## Update protocol

After every implementation checkpoint, update this file with:

- current phase and status;
- files or packages changed;
- tests or checks run;
- decisions made or reversed;
- known risks or blockers;
- the next concrete checkpoint.

Architecture changes must also add or update an ADR under `docs/architecture/decisions/`.

## Activity log

### 2026-08-17 — Architecture baseline

- Reviewed the original proposal and its NestJS-inspired lifecycle.
- Rechecked the current Next.js Route Handler contract and Next.js 16 Proxy changes.
- Decided against hidden global state and build-time route rewriting for the MVP.
- Created the project documentation baseline.

### 2026-08-17 — Factory API simplification

- Adopted `createRoute(config)` as the Factory constructor.
- The returned `route(options)` function creates individual Route Handlers.
- Configuration modules may live in any application directory.
- Rejected a mandatory `route-infra.config.ts` convention and hidden configuration discovery.

### 2026-08-17 — First implementation checkpoint

- Added the pnpm workspace, Turborepo tasks, strict TypeScript builds, Vitest,
  Prettier, initial ESLint boundary, Changesets, and MIT package metadata.
- Added `@next-route-kit/core` contracts and pipeline runtime.
- Added `next-route-kit` with `createRoute({ ...config })`, `route({ handler })`,
  immutable `extend()`, plugin contribution resolution, and default JSON output.
- Refactored the Route Factory and Core Pipeline into owned classes, keeping the
  functional pipeline call only as a compatibility facade.
- Added `RoutePluginRegistry` to make plugin installation and parent/child
  contribution ownership explicit; child registries do not reinstall parent
  plugins.
- Verified `pnpm typecheck`, `pnpm build`, `pnpm test`, and `npm pack --dry-run`
  for both published packages.
- Known gap: standard input source definitions and Next-version integration
  fixtures are not implemented yet.

### 2026-08-17 — Cordis-inspired ownership checkpoint

- Reviewed the DeepSeek Harness/Cordis Context, Registry, Service, Fiber, and
  event ownership patterns as architecture references.
- Adopted only the compatible parts: class-owned responsibilities, explicit
  plugin Registry ownership, immutable parent/child scope derivation, and
  deterministic installation order.
- Explicitly rejected global service state, filesystem discovery, decorator
  metadata, request-context Proxy injection, and Fiber-style async reactivation
  for the Next.js Route Handler MVP.
- Added `@next-route-kit/core` `RoutePluginRegistry`; child registries reuse
  parent contributions and install only newly added plugins.
- Fixed lazy JSON body reads to cache both the one-shot text promise and parsed
  JSON promise.
- Added registry tests. Verified `pnpm typecheck`, `pnpm build`, `pnpm test`
  (Core: 10 tests; Next adapter: 6 tests), and `npm pack --dry-run` for both
  public packages.
- Next: implement standard input source primitives, then add real Next.js 15/16
  compatibility fixtures.

### 2026-08-18 — Completed-code Review checkpoint

- Reviewed the public Core and Next adapter surfaces, including Pipeline stage
  order, Factory immutability, plugin scope ownership, Request body handling,
  params/input failures, response configuration, package declarations, docs,
  and formatting.
- Found and fixed: un-mapped request preparation errors, mutable callable shell,
  mutable route input definition after compilation, missing route-level response
  alias, and invalid quick-start imports/state typing.
- Added regression coverage for preparation error mapping, Factory freezing,
  input snapshotting, route response alias behavior, and the expanded plugin
  Registry contract.
- Residual gaps are intentional Phase 4 work: runtime compatibility diagnostics
  and real Next.js 15/16 fixtures.

### 2026-08-18 — Input source and immutability follow-up

- Status: Phase 4 remains `in_progress`.
- Changed: added standard request input sources, mixed source/literal composition,
  source-map snapshots, reserved-key-safe query parsing, and runtime-frozen plugin
  registries; duplicate response serializers now fail explicitly.
- Verified: the Next adapter suite covers body/query/params/headers/text input,
  mixed maps, source snapshots, and reserved query keys; strict type checking
  passes after the changes. The final Core/Next suites pass with 12/16 tests;
  builds, formatting, and packed package manifests also pass.
- Decisions: input sources remain Web API based and validator-agnostic; validation
  stays in Input Pipes or optional packages.
- Risks: real Next.js 15/16 and Node/Edge fixture builds are still not present;
  plugin `runtime` metadata is still declarative only. Full external consumer
  installation still needs a registry-backed or CI package-install check; the
  local offline cache has no npm metadata for the scoped Core package.
- Next: add compatibility fixtures, then begin the validation adapter slice.

### 2026-08-18 — GitHub repository metadata checkpoint

- Status: local repository metadata prepared; the remote `tech-zjf/next-route-kit`
  repository is public but currently empty.
- Changed: added package author/repository/bugs/homepage/keywords metadata, project
  links, `AUTHORS.md`, `CITATION.cff`, contribution/community/security policies,
  CODEOWNERS, CI, PR template, and bug/feature/compatibility Issue forms.
- Verified: Prettier, typecheck, build, and test checks remain passing after the
  metadata and workflow additions.
- Decisions: `tech-zjf` is recorded as the repository owner and initial maintainer;
  no legal name or email was inferred.
- Risks: no remote commit or GitHub Issue has been created yet because the local
  directory is not a Git checkout and the requested push/Issue creation scope has
  not been confirmed.
- Next: confirm remote publication and create the reviewed roadmap Issues.

### 2026-08-18 — Commit quality checkpoint

- Status: local commit-time quality gates are implemented and passing.
- Changed: added root ESLint Flat Config, `pnpm lint`, Husky `pre-commit`, and
  `lint-staged` rules for staged TypeScript/JavaScript and config/documentation
  files; CI now runs the same full-repository lint command.
- Verified: `pnpm lint` and `pnpm exec prettier --check .` pass; the hook was
  exercised in an isolated Git fixture with a staged TypeScript file and
  re-staged Prettier changes automatically.
- Decisions: source checks belong to `pre-commit`, while `commit-msg` is left
  available for a future commit-message policy; formatting is never deferred
  to that later hook because it would risk a worktree/index mismatch.
- Risks: lint rules are intentionally limited to correctness and unused-code
  detection; stylistic ownership remains with Prettier.
- Next: continue Phase 4 compatibility fixtures and validation adapters.

### 2026-08-18 — Test layout checkpoint

- Status: test/source directory boundaries are normalized.
- Changed: moved Core and Next adapter tests from `src/` to package-level
  `tests/` directories; updated relative imports and TypeScript include/exclude
  patterns.
- Verified: Vitest discovery continues to find all tests, while package builds
  keep `tests/` outside the emitted `dist/` tree.
- Decisions: `src/` is reserved for publishable runtime code; `tests/` is the
  home for unit tests and the future integration/compatibility fixture suites.
- Risks: none identified; no public package export changes were introduced.
- Next: continue Phase 4 compatibility fixtures and validation adapters.
