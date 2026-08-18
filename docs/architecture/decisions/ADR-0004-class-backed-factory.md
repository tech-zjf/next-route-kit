# ADR-0004: Use a class-backed, immutable Route Factory

- Status: accepted
- Date: 2026-08-17

## Context

The Route Factory owns more than a single function call: it resolves plugins,
freezes configuration, creates child scopes, compiles a pipeline, and controls
when those operations happen. Keeping those responsibilities as unrelated
module functions makes lifecycle and ownership harder to see.

Class-oriented plugin systems demonstrate a useful pattern: context, registry,
service, and lifecycle responsibilities are represented by objects with explicit
ownership. The Route Kit adopts that boundary without importing a dependency-
injection or reactive service model into Next.js Route Handlers.

## Decision

Implement the user-facing Factory as a `Factory` class.

```ts
export const createRoute = new Factory({}, 'root')

const route = createRoute({
    middleware: [requestLogger()],
})

export const GET = route({
    handler: async () => ({ ok: true }),
})
```

The root instance is callable only as a small ergonomic shell that creates a
configured `Factory`. A configured Factory is callable to create a concrete
Route Handler. The class itself owns:

- immutable configuration snapshots;
- composition with the Core `RoutePluginRegistry`;
- `extend()` scope derivation;
- one-time pipeline compilation;
- request input/body cache creation at handler execution time;
- immutable callable shell and a public read-only config snapshot.

`RoutePluginRegistry` owns plugin installation and contribution aggregation. A
child scope reuses parent contributions and installs only newly added plugins;
the Factory then merges the resulting stage lists into its immutable snapshot.

`RoutePipeline` is also a class. The old `executeRoutePipeline()` function is
kept as a thin compatibility facade, not as the primary implementation.
Its optional request-preparation callback runs inside the same error boundary as
the middleware, guards, pipes, interceptors, handler, and serializer.

## What is intentionally not included

- no global service registry;
- no runtime file scanning;
- no decorator requirement;
- no request-time dependency hot reloading;
- no Proxy-based `RouteContext` property injection;
- no Fiber-like asynchronous plugin reactivation in the MVP.

These features solve a different problem and would increase the Next.js
compatibility surface. Plugin instances are installed during Factory/route
construction, while request state remains local to a single Route Handler call.

## Consequences

Positive:

- ownership and lifecycle are visible in the class API;
- a Factory can be inspected and tested as an object;
- child scopes remain explicit and immutable;
- pipeline compilation is not repeated for every request;
- the public call syntax stays short and familiar.

Trade-off:

- the callable class uses a small Proxy wrapper because JavaScript class
  instances are not directly callable;
- the Proxy is only an API adapter and must not become a hidden global registry.
