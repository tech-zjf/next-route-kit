# ADR-0008: Keep route test helpers in a runner-neutral package

## Status

Accepted.

## Context

Route Handlers are already functions over Web API `Request`, `Response`, and a
Next-compatible params context. Tests should be able to invoke those functions
without booting a Next.js server, while still covering the same request inputs,
response policy, and plugin installation behavior used in production.

Coupling the helpers to Vitest or Jest would make the package choose an
application test runner and would make the public package harder to reuse in
Node's test runner, integration harnesses, or downstream libraries.

## Decision

Publish `@next-route-kit/testing` as an independent package with no test-runner
dependency. The package exposes class-backed helpers:

- `RequestBuilder` creates immutable native requests and Promise-based route
  params, with query, header, JSON, text, and raw-body methods;
- `invokeRoute()` calls a public Route Handler directly with a `Request` and
  context, without a Next.js server;
- `ResponseAssertions` and `expectResponse()` provide small async assertions
  for status, headers, text, and JSON while caching one-shot response reads;
- `TestPlugin` and `createTestPlugin()` provide deterministic plugin doubles for
  registry and Factory-scope tests.

The package imports only public `next-route-kit` types and Web APIs. It does not
own a test lifecycle, discover route files, or introduce a second route
execution model.

## Consequences

Positive:

- route behavior can be tested quickly without a server or framework boot;
- consumers choose their own test runner and assertion reporting;
- immutable builders make shared request setup safe across test cases;
- cached response reads prevent a test assertion from consuming a one-shot body
  before a later assertion.

Trade-off:

- direct invocation does not replace Next.js integration tests; framework
  behavior such as routing, caching, rendering, and deployment runtime still
  belongs in the Next.js fixture matrix;
- the assertion API intentionally stays small and does not attempt to mirror
  every matcher from Vitest or Jest.

## Rejected alternatives

- Put the helpers in `next-route-kit`: rejected because production consumers
  should not receive test-only APIs or dependencies.
- Depend on Vitest/Jest and export custom matchers: rejected because it couples
  the package to one runner and reduces portability.
- Start a Next.js server for every unit test: rejected because it is slower and
  tests framework boot behavior instead of the Route Factory pipeline.
