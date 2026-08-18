# ADR-0009: Validate plugin runtime compatibility during Factory compilation

## Status

Accepted.

## Context

Next.js chooses a Route Handler runtime through the route module's exported
`runtime` value. A Factory can be shared across route modules, and plugins can
declare whether they support `nodejs`, `edge`, or both. Without a check, a
Node-only plugin can be composed into an Edge route and fail later during
bundling or deployment with a framework-level error that does not identify the
responsible plugin.

The package cannot inspect a sibling `export const runtime` from a route module
without compiler transforms or filesystem scanning. Those mechanisms would
break the explicit-import model and increase the Next.js adapter's upgrade
surface.

## Decision

Add an optional `runtime` target to `RouteFactoryConfig` and `RouteOptions`:

```ts
const route = createRoute({
    runtime: 'edge',
    plugins: [tracingPlugin()],
})
```

The application keeps the value aligned with the route module:

```ts
export const runtime = 'edge'
```

During Factory and route compilation, `RoutePluginRegistry` validates every
registered plugin. An incompatible plugin throws
`RuntimeIncompatiblePluginError` with the plugin name, declared support, target
runtime, and a separate-Factory remediation suggestion. Parent and child
registries compose already-installed contributions, so validation does not
reinstall plugins while deriving scopes or compiling routes.

The configured runtime is also copied to `RouteContext.meta.runtime` for
diagnostic and instrumentation components. Omitting `runtime` keeps the
existing permissive behavior; plugin metadata is then documentation rather
than an assertion.

## Consequences

Positive:

- incompatible composition fails close to the configuration that caused it;
- the Core and adapter remain independent of Next.js compiler internals;
- plugin installation remains deterministic and happens once per Factory
  scope;
- applications can use separate Node and Edge Factories while sharing Core
  contracts.

Trade-off:

- the `runtime` value is intentionally duplicated next to Next's module export;
  the package cannot safely infer it from another module without rewriting the
  user's project;
- static metadata cannot prevent a Node-only module from being imported into an
  Edge bundle, so plugin packages must still preserve their own import boundary.

## Rejected alternatives

- Read `export const runtime` from route files automatically: rejected because
  it requires filesystem discovery or a compiler plugin.
- Detect the runtime from `process`, `globalThis`, or a request: rejected
  because the failure would happen too late and would not protect Edge builds.
- Silently skip incompatible plugins: rejected because it hides security,
  tracing, and persistence behavior changes.
