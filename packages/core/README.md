# @next-route-kit/core

Framework-neutral contracts, plugin registry, and pipeline runtime for
`next-route-kit`.

This package intentionally depends on Web APIs and TypeScript contracts rather
than importing Next.js. The user-facing `next-route-kit` package adapts these
contracts to App Router Route Handler functions. `RoutePluginRegistry` owns
explicit plugin installation and immutable parent/child contribution scopes;
its registry instances are frozen after installation; `RoutePipeline` owns
deterministic request-stage execution.
