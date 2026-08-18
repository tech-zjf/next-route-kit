# ADR-0002: Isolate Next.js behavior behind an adapter

- Status: accepted
- Date: 2026-08-17

## Context

Next.js Route Handler behavior evolves. The current public contract includes named HTTP method exports, Web `Request` / `Response`, Promise-based dynamic route parameters, and catch-all parameters that may be arrays. Next.js 16 also renamed the network-boundary file from `middleware.ts` to `proxy.ts` and changed its Runtime rules.

## Decision

Split the implementation into:

```text
@next-route-kit/core
  Framework-neutral pipeline and contracts

next-route-kit
  Next.js Route Handler adapter and user-facing Factory
```

The core package must not import `next`, `next/server`, or Next.js private modules.

The Next adapter owns:

- Route Handler function signatures;
- `params` normalization;
- `NextRequest` and `NextResponse` helpers;
- Next-specific response behavior;
- compatibility shims for supported Next.js versions.

The first adapter slice intentionally consumes the public Web `Request` /
`Response` contract and structural Route Handler context types. It therefore does
not require a runtime import from `next` or `next/server`; version-specific Next
helpers can be added behind separate entry points when a fixture demonstrates a
real need.

## Consequences

When Next.js changes its Route Handler surface, the adapter and its fixtures should change first. The core pipeline, plugin contracts, and application-level Factory should remain stable.

The project cannot promise compatibility with an unknown future breaking contract, but it can reduce the migration surface to the adapter package and version-specific tests.

## Runtime policy

Runtime capability is declared as static plugin metadata:

```ts
type RuntimeSupport = 'nodejs' | 'edge' | 'both'
```

The core does not make business decisions based on runtime detection.

`proxy.ts` remains outside the MVP because it is a separate Next.js network boundary, not a Route Handler pipeline.
