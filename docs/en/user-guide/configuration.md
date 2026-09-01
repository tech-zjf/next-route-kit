# Configuration and scopes

**English** · [简体中文](../../zh-CN/user-guide/configuration.md)

## Application scope

```ts
const apiRoute = createRoute({
    middleware: [requestLogger],
    guards: [requireApiKey],
    pipes: [trimInput],
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
    response: jsonResponse(),
}).withLocals(requestContext)
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

## Runtime-backed locals

Use actual provider output when downstream Handlers require authenticated or
tenant-local fields:

```ts
const sessionRoute = apiRoute.withLocals({
    name: 'session',
    async provide(context) {
        const session = await authenticate(context.request)
        if (!session) throw unauthorized()
        return { userId: session.userId, organizationId: session.organizationId }
    },
})
```

The provider runs in the Guard stage before automatic body parsing. The Handler
runs only after the provider returns, so `locals.userId` and
`locals.organizationId` are required types. Do not use
`createRoute<RequiredLocals>()` to describe fields that no runtime operation
establishes.

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
| `maxBodyBytes`     | automatic body read limit                  |
| `nativeResponse`   | pass through or reject native Responses    |
| `plugins`          | reusable contributions                     |
| `middleware`       | outer processing around the complete chain |
| `guards`           | authentication and authorization           |
| `pipes`            | body/query validation and transformation   |
| `interceptors`     | advanced input/Handler result processing   |
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
