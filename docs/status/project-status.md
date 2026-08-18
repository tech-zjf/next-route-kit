# Project Status

Last updated: 2026-08-18

## Current state

```text
Phase: 8 - Documentation and release completed locally; remote CI/npm publication pending maintainer action
Status: All runtime packages, bilingual user guides, package boundaries, real user-journey tests, compatibility checks, Changesets baseline, release gate, and protected Release workflow are implemented locally
Implementation code: Core pipeline, immutable Route Factory, source metadata, Next 15/16 fixtures, @next-route-kit/zod, and @next-route-kit/testing
Next step: commit and push the release candidate, observe CI, configure npm scope/secret, and approve the protected Release workflow
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
- Added immutable input-source metadata to `RouteContext` and propagated it to
  `InputPipe`; composed input maps expose field-level source locations without
  introducing a validation library dependency.
- Added `apps/next15-fixture` and `apps/next16-fixture`; each covers Node.js and
  Edge Route Handlers, async params, query input, JSON body input, and the
  workspace package boundary.
- Added `pnpm verify:packed` and a temporary external-consumer fixture; the
  public package tarballs install outside the workspace, compile through their
  public exports, and pass runtime Route Handler smoke tests.
- Added `@next-route-kit/zod` as an independent optional adapter with
  `ZodInputPipe`, `ZodErrorMapper`, async parsing, immutable normalized issues,
  and a peer dependency on Zod 4.
- Added `@next-route-kit/testing` as an independent runner-neutral package with
  immutable `RequestBuilder`, direct `invokeRoute()`, cached response
  assertions, and deterministic `TestPlugin` helpers.
- Added a real authenticated order-flow integration test instead of relying on
  bare `createRoute()` examples: request ID Middleware, authentication Guard,
  async Input Resolver, validation Input Pipe, success Response Interceptor,
  Error Mapper, dynamic params, query, JSON body, and short-circuit behavior
  are all exercised through public package APIs.
- Upgraded both Next.js compatibility fixtures with the same user-shaped order
  route and shared Factory scopes; production and Turbopack development smoke
  tests now cover successful orders, unauthorized malformed bodies, and the
  stable validation/response contract.
- Added bilingual `why-route-kit` user documentation with a handwritten
  Route Handler versus shared Factory comparison, a stage-to-problem mapping,
  and guidance to test business journeys rather than only framework defaults.
- Added runtime compatibility diagnostics to `RoutePluginRegistry` and the
  Route Factory; incompatible plugin declarations now fail with
  `RuntimeIncompatiblePluginError`, and configured runtime metadata reaches
  `RouteContext.meta.runtime`.
- Completed the explicit Scope safety policy: inherited components cannot be
  removed by child routes in 0.1.0, so security behavior has no silent opt-out.
- Added public quick-start, scope, plugin, runtime, error/response, and
  migration guides, plus 0.1.0 release notes and a maintainer release checklist.
- Added separate `docs/en/` and `docs/zh-CN/` user-documentation trees with
  matching pages and language-switch links; maintainer documentation now has a
  separate development index.
- Added package-level `CHANGELOG.md`, Node.js engine metadata, explicit npm
  file allowlists, absolute npm README links, and an actual tarball boundary
  verifier that rejects source, test, fixture, and workspace files.
- Added `docs:check` to validate local Markdown links and bilingual user-guide
  parity.
- Added `release:check`, `release:status`, `release:version`, and
  `release:publish` scripts, an initial public-release Changesets marker, and a
  manually confirmed protected npm Release workflow.

## Current decisions

| Decision                                                                                      | Status                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Preserve `app/**/route.ts`                                                                    | accepted                                                                              |
| Use `createRoute({ ...config })` as the Factory constructor                                   | accepted                                                                              |
| Allow the Factory/config module in any directory                                              | accepted                                                                              |
| Require a central `route-infra.config.ts` file                                                | rejected; optional convention only                                                    |
| Keep `next.config.ts` for build integration only                                              | accepted                                                                              |
| Keep `proxy.ts` outside the MVP                                                               | accepted                                                                              |
| Core package must not import Next.js                                                          | accepted                                                                              |
| Main package name: `next-route-kit`                                                           | provisional; no published version found on 2026-08-18; scope ownership still required |
| Public input terminology should prefer `input` and validator helpers                          | accepted                                                                              |
| Public response terminology should prefer `ResponseSerializer`                                | accepted                                                                              |
| The first adapter slice uses Web API-compatible structural types and does not import `next`   | accepted                                                                              |
| Default JSON serialization belongs to `next-route-kit`; Core remains serializer-agnostic      | accepted                                                                              |
| Route Factory and Pipeline are class-backed; callable syntax is only an ergonomic Proxy shell | accepted                                                                              |
| Plugin installation belongs to an immutable Core `RoutePluginRegistry`                        | accepted                                                                              |
| Next Route Handler context uses Promise-based `params` in the public export                   | accepted                                                                              |
| Verify paired package tarballs before registry publication                                    | accepted                                                                              |
| Keep Zod validation in `@next-route-kit/zod`, not Core or the Next adapter                    | accepted                                                                              |
| Keep route test helpers in `@next-route-kit/testing` without choosing a test runner           | accepted                                                                              |
| Validate declared plugin/runtime compatibility during Factory compilation                     | accepted                                                                              |
| Inherited Scope components cannot be removed in 0.1.0                                         | accepted                                                                              |

## Next implementation checkpoint

The next checkpoint is the remaining external release work:

1. Commit and push the completed release candidate.
2. Observe the remote CI matrix and configure npm `@next-route-kit` scope access.
3. Approve the protected Release workflow and record published versions/tags.

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

### 2026-08-18 — Input metadata checkpoint

- Status: the validator-neutral input metadata slice is implemented.
- Changed: added optional `RouteContext.inputMetadata`, source metadata for
  standalone inputs, and field-level metadata for mixed input source maps;
  added Core and Next adapter regression tests and ADR-0006.
- Verified: Core has 13 passing tests and the Next adapter has 17 passing tests;
  lint, formatting, typecheck, build, and Vitest all pass.
- Decisions: metadata describes input origin only; schema parsing and validation
  remain in Input Pipes or optional adapter packages. Existing contexts without
  metadata continue to receive the `custom/route-input` fallback.
- Risks: Next.js 15/16 integration fixtures and packed external-consumer tests
  are still outstanding.
- Next: add the first real Next.js compatibility fixture matrix.

### 2026-08-18 — Next compatibility fixture checkpoint

- Status: Phase 4 exit criteria are met; the compatibility matrix foundation is
  now in Phase 7 `in_progress`.
- Changed: added Next 15.5.23 and Next 16.3.1 fixture apps with Node and Edge
  Route Handlers, async params, query input, JSON body input, and package-level
  TypeScript/build configuration; added `.next` Turbo outputs and ignore rules;
  added a GitHub Actions matrix job that builds and smoke-tests each fixture.
- Verified: both fixtures pass `tsc --noEmit`, `next build`, and local HTTP
  smoke tests for `/api/node`, `/api/edge`, `/api/params/42`, and
  `POST /api/echo` with HTTP 200 responses.
- Decisions: keep `params` Promise-based in the last public Handler overload so
  Next 15 build-time validation and Next 16 type generation agree; preserve a
  synchronous context overload only for direct legacy calls. Core remains
  unchanged by Next version differences.
- Risks: Next 16.3.1 emits an Edge Runtime deprecation warning, and Next 15
  emits an ESLint plugin discovery warning in the minimal fixture; neither
  prevents build or request handling. CI should make these warnings visible.
- Next: observe the CI fixture and packed-consumer jobs, then add runtime
  diagnostics and implement the optional validation adapter.

### 2026-08-18 — Packed consumer checkpoint

- Status: the package publication boundary is locally verified; Phase 7 remains
  `in_progress` until remote CI, development-mode coverage, and runtime
  diagnostics are complete.
- Changed: added the packed-consumer fixture and `pnpm verify:packed`; the
  script packs both public packages, installs them outside the workspace with a
  temporary paired-Core override, type-checks a real consumer, executes a
  request, and checks package exports.
- Verified: the packed consumer returned HTTP 200 with the expected query
  value, and the tarball manifest exposed `dist/index.js` and
  `dist/index.d.ts` through the public export metadata.
- Decision: keep the paired-package override only inside the pre-publication
  verification harness; published consumers should resolve Core from the
  registry through the normal semver dependency.
- Risks: the remote registry install path cannot be exercised until the first
  public release exists; runtime-incompatible plugin diagnostics are still
  declarative.
- Next: observe CI, then add the testing helper package and runtime diagnostics.

### 2026-08-18 — Zod adapter checkpoint

- Status: Phase 6 is `in_progress`; the first optional validation adapter is
  implemented, while `@next-route-kit/testing` remains outstanding.
- Changed: added `@next-route-kit/zod` with class-backed `ZodInputPipe`,
  `ZodValidationError`, and configurable `ZodErrorMapper`; Zod is a peer
  dependency and Core remains validator-agnostic. Added ADR-0007.
- Verified: the adapter has passing typecheck, build, and four unit tests;
  the packed consumer installs the adapter and Zod tarballs outside the
  workspace and passes both valid and invalid request checks.
- Decision: schema parsing uses Zod's async parse API, and normalized issues
  are immutable before they reach the JSON error mapper. Static handler input
  types remain explicit because Input Pipes transform values at runtime.
- Risks: the adapter currently targets Zod 4; a future Zod 3 compatibility
  range would require a separate type and runtime matrix.
- Next: observe CI, then implement `@next-route-kit/testing` request and
  response helpers.

### 2026-08-18 — Testing package checkpoint

- Status: Phase 6 is completed; Phase 7 remains `in_progress` for remote CI,
  Turbopack development coverage, and runtime diagnostics.
- Changed: added `@next-route-kit/testing` with the class-backed immutable
  `RequestBuilder`, direct `invokeRoute()`, cached `ResponseAssertions`, and
  deterministic `TestPlugin`/`createTestPlugin()` helpers. Added ADR-0008 and
  package documentation with body, query, headers, params, response, and plugin
  examples.
- Verified: the package has passing typecheck, build, and five unit tests.
  `pnpm verify:packed` now packs Core, `next-route-kit`, Zod, testing, and the
  Zod peer tarball; an external temporary consumer installs all four public
  packages, type-checks imports, executes valid and invalid Route Handler
  requests, and verifies package export metadata.
- Decision: keep testing helpers independent from Vitest, Jest, and Next.js
  server boot. Direct invocation covers the pipeline; Next routing, caching,
  and runtime behavior remain in the compatibility fixtures.
- Risks: runtime-incompatible plugin metadata is still declarative only and the
  remote CI workflow has not yet been observed from this local checkout.
- Next: observe CI and record the first remote compatibility results.

### 2026-08-18 — Turbopack development checkpoint

- Status: local production and development compatibility coverage is complete;
  Phase 7 remains `in_progress` until the GitHub Actions matrix is observed.
- Changed: added `scripts/verify-next-dev.mjs`, the
  `pnpm verify:next:dev` command, and a dedicated CI job. The script starts
  Next.js 15.5.23 and 16.3.1 with `next dev --turbopack`, checks Node/Edge,
  params, and JSON body routes, and stops each server cleanly.
- Verified: both local Turbopack development fixtures pass the same smoke
  checks as the production builds; Next.js 16 continues to emit its documented
  Edge Runtime deprecation warning.
- Decision: keep production and development compatibility as separate CI
  signals because they exercise different Next.js compiler/server paths.
- Risk: remote runner behavior and future Next.js CLI flag changes still need
  to be observed in CI.
- Next: observe CI and update the matrix with the first remote result.

### 2026-08-18 — Runtime diagnostics checkpoint

- Status: local runtime compatibility diagnostics are implemented; Phase 7
  remains `in_progress` for remote CI and development-mode coverage.
- Changed: added optional `runtime` targets to Factory and route options, added
  `RuntimeIncompatiblePluginError`, validated plugin declarations during Core
  registry snapshots and Factory composition, and exposed the selected runtime
  through `RouteContext.meta.runtime`. Added ADR-0009.
- Verified: Core has 15 passing tests and the Next adapter has 20 passing tests;
  tests cover direct registry validation, global Factory validation, inherited
  plugin validation during `extend()`, runtime metadata, and single-install
  composition.
- Decision: runtime is explicit configuration aligned with Next's module export;
  the adapter does not inspect route files or rewrite the build.
- Risk: static metadata cannot make an unsafe Node-only import Edge-compatible;
  plugin packages must still keep Node-only code out of Edge entrypoints.
- Next: observe CI, then add Turbopack development-mode fixture coverage.

### 2026-08-18 — Nest-style lifecycle correction checkpoint

- Status: the completed-code review found and corrected input preparation order;
  Phase 7 remains `in_progress` and Phase 5 remains pending for mandatory
  plugins, opt-out policy, and public scope examples.
- Changed: Middleware and Guards now run before route input resolution; Input
  Pipes run before Interceptors and the Handler. Next params are hydrated before
  middleware/guards as framework context, while route input remains deferred.
  Added default mapping for
  `HttpError` and malformed JSON, fixed repeated URLSearchParams values, made
  testing params snapshots immutable, widened route params for optional
  catch-all values, and ignored Next-generated agent files in fixtures.
- Verified: regression tests cover lifecycle order, Guard access to hydrated
  params, guard short-circuiting, optional catch-all params, malformed JSON
  responses, repeated query values, and params snapshots.
- Decision: keep the user-facing lifecycle explicit as
  `Middleware → Guard → Input Resolver → Input Pipe → Interceptor → Handler`.
- Risk: Next 16 still reports its Edge Runtime deprecation warning, and remote
  CI results have not yet been observed from this checkout.
- Next: observe remote CI, then continue scope configuration.

### 2026-08-18 — Lifecycle and compatibility verification

- Status: the corrected lifecycle and local compatibility checks are verified;
  Phase 7 remains `in_progress` only for remote CI observation.
- Changed: separated Next params hydration from route input preparation so
  Middleware and Guards can use dynamic params without reading Body; aligned
  architecture examples so the built-in `defaultErrorMapper()` is not manually
  registered twice.
- Verified: `pnpm test` passes all 53 tests; `pnpm typecheck`, `pnpm lint`,
  Prettier, `pnpm build`, `pnpm verify:packed`, and
  `pnpm verify:next:dev` all pass. Next.js 15.5.23 and 16.3.1 both pass
  production and Turbopack development smoke tests.
- Decision: keep the public order as
  `Middleware → Guard → Input Resolver → Input Pipe → Interceptor → Handler`.
- Risks: Next 16 emits its documented Edge Runtime deprecation warning, and
  remote GitHub Actions results have not been observed from this checkout.
- Next: observe remote CI, then continue Phase 5 scope configuration.

### 2026-08-18 — Formal release documentation checkpoint

- Status: Phase 8 is completed locally; the 0.1.0 release candidate is
  releasable locally and has no remaining code or documentation gate.
- Changed: added the formal quick-start, scope, plugin, runtime, error, and
  migration guides; 0.1.0 release notes; the maintainer release checklist;
  Changesets baseline handling; release scripts; and a manually confirmed,
  protected npm workflow with serialized execution.
- Verified: `pnpm release:status` and `pnpm release:check` pass. The release
  gate covers 53 tests, lint, typecheck, builds, packed external-consumer
  verification, Next.js 15/16 production smoke tests, and Turbopack
  development smoke tests.
- Decisions: the initial public package manifests remain at `0.1.0`; later
  public changes require non-empty Changesets. The release workflow pushes only
  generated tags after explicit confirmation, so source commits still follow
  normal `main` protection.
- Risks: remote CI and npm publication have not been run from this local
  checkout. Next.js 16's Edge Runtime deprecation warning and Next.js 15's
  minimal-fixture ESLint warning remain documented, non-blocking framework
  warnings.
- Next: commit and push the release candidate, observe CI, configure npm scope
  and `NPM_TOKEN`, then approve the protected `npm-release` workflow.

### 2026-08-18 — User documentation and npm boundary checkpoint

- Status: the public user-facing documentation and npm artifact boundary are
  now separated from maintainer documentation and verified locally.
- Changed: added matching English and Simplified Chinese user-guide trees for
  installation, getting started, configuration, API parameters, input sources,
  validation, pipeline components, testing, and troubleshooting. Added a
  localized 0.1.0 release note and language-switch links on every user page.
  Removed the superseded single-language `docs/guides` copy to keep one
  canonical user-documentation structure.
- Changed: public package manifests now explicitly ship only `dist`,
  `README.md`, `CHANGELOG.md`, and `LICENSE` in addition to npm's generated
  `package.json`; package READMEs use absolute repository links that work from
  npm pages.
- Verified: `pnpm docs:check` validates 50 Markdown files and nine bilingual
  user-guide page pairs. `pnpm verify:packed` passes and reports the actual
  allowlisted tarball boundaries for all four public packages.
- Decision: `docs/en` and `docs/zh-CN` are the only canonical application-user
  documentation entrypoints; architecture, implementation, status, and
  release operations remain under the maintainer documentation index.
- Risk: external npm scope ownership, credentials, remote CI, and publication
  approval are still maintainer actions and have not been executed locally.
- Next: run the final full release gate, then commit and push the release
  candidate through the normal repository workflow.

### 2026-08-18 — Final user documentation and release gate verification

- Status: the local release candidate is closed from the code, documentation,
  packaging, and verification perspective.
- Changed: added matching plugin-authoring and migration pages to both language
  trees, localized release-note navigation, and the normal CI documentation
  link/parity check.
- Verified: the final `pnpm release:check` passes, including `docs:check`,
  lint, typecheck, all 53 tests, builds, four npm tarball allowlist checks,
  packed external-consumer execution, and Next.js 15/16 production plus
  Turbopack development smoke tests. `pnpm release:status` reports no pending
  version bump for the initial `0.1.0` baseline.
- Known non-blocking warnings: Next.js 15's minimal fixture ESLint plugin
  warning and Next.js 16's Edge Runtime deprecation warning.
- Next: commit and push from the maintainer checkout, observe remote CI,
  configure npm credentials and scope ownership, then approve the protected
  Release workflow.

### 2026-08-18 — Real user journey checkpoint

- Status: the public evidence now includes a real business scenario; the local
  release gate still needs one final run after these additions.
- Changed: added `packages/testing/tests/real-chain.test.ts` for authenticated
  order creation, unauthorized malformed-body rejection, and post-auth input
  validation. Added shared Middleware, Guard, Interceptor, Error Mapper, and
  scope Factories to both Next.js 15/16 fixtures, plus
  `/api/accounts/[accountId]/orders`.
- Changed: added the bilingual `why-route-kit` guide and real-business testing
  examples; compatibility docs and CI smoke checks now assert the order flow.
- Verified: the real-chain suite passes 10 tests, both fixture typechecks and
  production builds pass, `pnpm verify:next:prod` passes both Next versions,
  `pnpm verify:next:dev` passes both Turbopack fixtures, and `pnpm docs:check`
  validates 52 Markdown files and 10 bilingual user-guide pairs.
- Decision: keep bare routes only as focused default/compatibility unit cases;
  the primary integration evidence must exercise a real user-shaped request
  through the full public lifecycle.
- Risks: the local sandbox cannot bind fixture ports without explicit command
  approval; Next.js 15 ESLint-plugin and Next.js 16 Edge Runtime warnings
  remain documented framework warnings. Remote CI and npm publication remain
  maintainer actions.
- Next: run `pnpm release:check` with local-port permission, then update this
  log with the final result before handoff.

### 2026-08-18 — Real-chain release gate checkpoint

- Status: the real user-journey additions are included in the locally verified
  release candidate.
- Verified: `pnpm release:check` passes `git diff --check`, documentation
  parity, lint, typecheck, 56 tests, all package builds, four npm tarball
  boundary checks, packed external-consumer execution, Next.js 15/16
  production order-flow smoke tests, Next.js 15/16 Turbopack order-flow smoke
  tests, and the full Prettier check. `pnpm release:status` reports no pending
  version bump for the initial `0.1.0` baseline.
- Evidence: the public tests now include a real success path, an unauthorized
  malformed-body path that stops before input resolution, and a validation
  error path that stops before the Handler. The Next fixtures execute the same
  contract through actual App Router modules.
- Remaining work: commit and push from the maintainer checkout, observe remote
  CI, configure npm scope ownership and `NPM_TOKEN`, then approve the protected
  Release workflow. No commit, push, GitHub mutation, or npm publication was
  performed in this task.

### 2026-08-18 — Commit hook ignored-file warning fix

- Found: `lint-staged` passed ignored Next-generated `next-env.d.ts` files
  explicitly to ESLint, so `--max-warnings=0` rejected two non-code warnings.
- Changed: added `--no-warn-ignored` to the staged TypeScript/JavaScript ESLint
  command. Real staged source files remain subject to the zero-warning policy.
- Verified: the staged `lint-staged` run completed successfully with Prettier
  and ESLint, and the fix is included in the staged `package.json`.
