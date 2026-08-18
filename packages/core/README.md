# @next-route-kit/core

Framework-neutral contracts, plugin registry, and pipeline runtime for
`next-route-kit`.

```bash
pnpm add @next-route-kit/core
```

For application usage, start with the [English user guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/README.md)
or [简体中文用户指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/README.md). This package is the advanced
framework-neutral layer for plugin authors and adapter authors.

This package intentionally depends on Web APIs and TypeScript contracts rather
than importing Next.js. The user-facing `next-route-kit` package adapts these
contracts to App Router Route Handler functions. `RoutePluginRegistry` owns
explicit plugin installation and immutable parent/child contribution scopes;
its registry instances are frozen after installation; `RoutePipeline` owns
deterministic request-stage execution. When a target runtime is supplied,
`RoutePluginRegistry.snapshot(runtime)` validates plugin runtime declarations and
throws `RuntimeIncompatiblePluginError` before route compilation continues.
Application users normally install `next-route-kit`; use Core directly when
authoring plugins or building another Web API-compatible adapter.
