# ADR-0005: Give plugin installation an explicit Registry owner

- Status: accepted
- Date: 2026-08-17

## Context

The first Route Factory slice treated plugin installation as an internal array
transformation. That works for simple middleware, but it hides an important
ownership question: which scope installed a plugin, and should a child scope
install the parent plugin again?

Cordis separates plugin registration and runtime ownership behind a Registry and
Fiber model. The Route Kit needs the ownership boundary, but not Cordis's
long-lived reactive service runtime because a Next.js Route Handler is created
by the module graph and executed with request-local state.

## Decision

Add `RoutePluginRegistry` to `@next-route-kit/core`.

```ts
const root = new RoutePluginRegistry(globalPlugins)
const scoped = root.extend(scopePlugins)

const rootContribution = root.snapshot()
const scopedContribution = scoped.snapshot()
```

The Registry owns:

- the immutable plugin list for one configuration scope;
- one-time `install()` calls for that Registry's new plugins;
- immutable contribution storage;
- stable contribution aggregation;
- parent-to-child derivation without reinstalling parent plugins.

The `Factory` remains the application-facing composition root. It delegates
plugin installation/aggregation to the Registry, merges the resulting stage
lists, and gives the compiled lists to `RoutePipeline`.

## Lifecycle boundary

The MVP does not promise an application shutdown hook or request-time plugin
reactivation. A plugin must therefore treat `install()` as construction of a
route-scope capability, not as a place to start a process-global daemon.

When resource disposal is needed, it will be added as an explicit Factory or
adapter lifecycle API with tests for Node development reloads and serverless
semantics. It will not be inferred from module unload or a mutable global
registry.

## Consequences

Positive:

- plugin ownership is visible and testable;
- `extend()` does not duplicate parent installation side effects;
- the Core can evolve plugin lifecycle support without changing the pipeline
  stage contracts;
- plugin order remains deterministic.

Trade-offs:

- a child Registry stores inherited contributions, which is a small immutable
  memory cost;
- full runtime lifecycle management is intentionally deferred until the Next
  adapter can define reliable shutdown/reload semantics.

## What is borrowed from Cordis

- explicit ownership instead of scattered registration;
- immutable parent/child composition;
- a separate place for plugin installation and lifecycle policy.

## What is not borrowed

- no global context singleton;
- no filesystem plugin discovery;
- no dependency injection container;
- no Fiber scheduler or async reactivation;
- no request context Proxy injection.
