# ADR-0001: Use an explicit Route Factory for global configuration

- Status: accepted
- Date: 2026-08-17

## Context

Every Route Handler must receive the same request ID, tracing, response serialization, and error mapping behavior. Repeating those arrays in every `route.ts` file creates poor developer experience.

Next.js does not provide a public global Route Handler interceptor registration point. `proxy.ts` runs before the route and is a different network boundary. `next.config.ts` is loaded during Next.js build/server configuration rather than as a per-request Route Handler container.

## Decision

Use an application-owned module, located wherever the application prefers, that creates an immutable configured Route Factory through `createRoute()`:

```ts
export const route = createRoute({
    plugins: [requestId(), requestLogger()],
    response: jsonResponse(),
})
```

主包会自动追加内置 `defaultExceptionFilter()`；此处只需要注册业务自定义的
ExceptionFilter。

The configuration module does not need a special filename or a root-level location. Route files import the Factory and export the resulting handler:

```ts
export const GET = route({ handler })
```

The Factory can create child scopes through `extend()`.

## Consequences

Positive:

- global behavior is configured once;
- no mutable process-global registry;
- works with Serverless and Edge bundling;
- scope inheritance is explicit and testable;
- no dependency on Next.js compiler internals.

Trade-offs:

- routes must import the shared Factory;
- plain handlers that bypass the Factory are not automatically wrapped;
- directory scope is represented by an explicit child Factory rather than magic path scanning.

## Rejected alternatives

### Mutable `configureRoutes()` singleton

Rejected because it is order-dependent, test-hostile, and unreliable across bundles or server instances.

### Runtime configuration lookup from the project root

Rejected because deployed Edge and Serverless environments do not guarantee a project filesystem. A local module such as `src/server/routes/index.ts` is fine because it is imported explicitly and bundled normally.

### Automatic source transformation in the MVP

Rejected because it couples the package to Next.js bundler behavior and increases upgrade risk.

### Runtime plugin registration in `next.config.ts`

Rejected because configuration loading and Route Handler request execution are different lifecycles.
