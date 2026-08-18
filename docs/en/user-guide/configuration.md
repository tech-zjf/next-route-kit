# Configuration and scopes

[简体中文](../../zh-CN/user-guide/configuration.md) · **English**

`next-route-kit` has explicit configuration. There is no hidden global
registry, directory scan, or automatic `next.config.ts` injection.

## Factory configuration

```ts
const route = createRoute<State>({
    runtime: 'nodejs',
    plugins: [],
    middleware: [],
    guards: [],
    inputPipes: [],
    interceptors: [],
    errorMappers: [],
    responseSerializer: jsonResponse(),
})
```

| Property             | Type                 | Purpose                                                                         |
| -------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `runtime`            | `'nodejs' \| 'edge'` | Declares the runtime used by this Factory for plugin compatibility diagnostics. |
| `plugins`            | `RoutePlugin[]`      | Installs plugin contributions once for this Factory scope.                      |
| `middleware`         | `RouteMiddleware[]`  | Runs before Guards and can add request-local state.                             |
| `guards`             | `Guard[]`            | Admits or rejects a request before route input is resolved.                     |
| `inputPipes`         | `InputPipe[]`        | Validates or transforms resolved input.                                         |
| `interceptors`       | `Interceptor[]`      | Wraps the handler and can observe or transform its result.                      |
| `errorMappers`       | `ErrorMapper[]`      | Converts known errors into `Response` objects.                                  |
| `responseSerializer` | `ResponseSerializer` | Converts ordinary handler values into `Response` objects.                       |
| `response`           | `ResponseSerializer` | User-facing alias for `responseSerializer`.                                     |

All properties are optional. The main package supplies a JSON response
serializer and appends a default mapper for `HttpError` and malformed JSON.

## Route options

```ts
const GET = route({
    runtime: 'edge',
    input: query(),
    use: [],
    middleware: [],
    guards: [],
    inputPipes: [],
    interceptors: [],
    errorMappers: [],
    response: jsonResponse(),
    handler: ({ input }) => input,
})
```

| Property                          | Type                                         | Required | Purpose                                                 |
| --------------------------------- | -------------------------------------------- | :------: | ------------------------------------------------------- |
| `handler`                         | `(context) => value \| Promise<value>`       |   yes    | Business logic for the Route Handler.                   |
| `input`                           | value, resolver, Input Source, or source map |    no    | Resolves route input after Middleware and Guards.       |
| `use`                             | `RoutePlugin[]`                              |    no    | Short route-level alias for `plugins`.                  |
| `runtime`                         | `'nodejs' \| 'edge'`                         |    no    | Overrides the inherited runtime target for this route.  |
| `middleware`                      | `RouteMiddleware[]`                          |    no    | Adds route-local Middleware after inherited Middleware. |
| `guards`                          | `Guard[]`                                    |    no    | Adds route-local Guards after inherited Guards.         |
| `inputPipes`                      | `InputPipe[]`                                |    no    | Adds route-local Input Pipes.                           |
| `interceptors`                    | `Interceptor[]`                              |    no    | Adds route-local Interceptors.                          |
| `errorMappers`                    | `ErrorMapper[]`                              |    no    | Adds route-local Error Mappers with highest priority.   |
| `responseSerializer` / `response` | `ResponseSerializer`                         |    no    | Replaces the inherited serializer for this route.       |

`route(options)` returns a function that can be exported directly as `GET`,
`POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or `OPTIONS` from `route.ts`.

## Business scopes with `extend`

```ts
const route = createRoute({
    middleware: [requestIdMiddleware],
})

const authenticatedRoute = route.extend({
    guards: [requireUserGuard],
})

const adminRoute = authenticatedRoute.extend({
    guards: [requireAdminGuard],
})
```

`extend` never mutates its parent. It is useful for explicit application-owned
groups such as `publicRoute`, `authenticatedRoute`, `adminRoute`, and
`internalRoute`.

## Merge rules

| Component           | Effective order or rule                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| Middleware          | Global → Scope → Route; append and execute in that order.                 |
| Guards              | Global → Scope → Route; append and execute in that order.                 |
| Input Pipes         | Global → Scope → Route; append and execute in that order.                 |
| Interceptors        | Global → Scope → Route on entry; unwind in reverse order.                 |
| Error Mappers       | Route → Scope → Global → built-in default; first response wins.           |
| Response Serializer | The most local explicit serializer replaces the inherited one.            |
| Plugins             | Install in registration order; inherited plugin installations are reused. |
| Runtime             | The most local explicit runtime is checked against all composed plugins.  |

Inherited components cannot be removed or disabled in `0.1.0`. If a route needs
a different security policy, create a separate Factory with that policy rather
than adding an opt-out flag to a shared Factory.

## What is not global

This is global only within the Factory imported by a route. The package does
not automatically apply configuration to every `route.ts` in the repository.
That explicit boundary keeps behavior predictable in Serverless, Edge,
Turbopack, and future Next.js bundlers.
