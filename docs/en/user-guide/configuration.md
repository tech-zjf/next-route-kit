# Configuration and scopes

**English** · [简体中文](../../zh-CN/user-guide/configuration.md)

## Application scope

```ts
const apiRoute = createRoute<ApiLocals>({
    middleware: [requestContext],
    guards: [requireApiKey],
    pipes: [trimInput],
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
    response: jsonResponse(),
})
```

Every route created from `apiRoute` inherits this policy.

## Derived scopes

```ts
const authenticatedRoute = apiRoute.extend({
    guards: [requireUser],
})

const adminRoute = authenticatedRoute.extend({
    guards: [requireAdmin],
})
```

`extend()` is immutable. The parent remains unchanged, so a public route
cannot accidentally inherit an admin guard.

Components compose as:

```text
base Factory → derived Factory → route-local config
```

Middleware, guards, pipes, and interceptors append. Exception filters are tried
from the most local scope outward. A route response serializer overrides an
inherited serializer.

## Options

| Option             | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `runtime`          | Node/Edge plugin compatibility declaration |
| `plugins`          | reusable contributions                     |
| `middleware`       | outer processing and request-local setup   |
| `guards`           | authentication and authorization           |
| `pipes`            | body/query validation and transformation   |
| `interceptors`     | envelopes, timing, caching, tracing        |
| `exceptionFilters` | error to `Response` conversion             |
| `response`         | JSON serializer shorthand                  |
| `body`             | optional route body resolver               |
| `query`            | optional route query resolver              |
| `handler`          | business function                          |

Configuration is explicit. The package does not scan directories, mutate a
process-global registry, or require a special config file.

## Global does not mean universal

Put only truly shared policy on the base Factory. Use `extend()` for an
authenticated or admin boundary. Leave one-off behavior in the route file so
the reader can see it where it is used.
