# Plugins

**English** · [简体中文](../../zh-CN/user-guide/plugins.md)

Plugins package reusable request policies. A plugin is installed explicitly on
a Factory or a Route; there is no process-global registry and no filesystem
scan.

## Define a custom plugin

Implement `RoutePlugin` and return the stages that the plugin contributes from
`install()`. The following plugin adds timing logs around every Handler in the
Factory scope:

```ts
import { createRoute, type RoutePlugin } from 'next-route-kit'

export class RequestTimingPlugin implements RoutePlugin {
    readonly name = 'request-timing'
    readonly runtime = 'both' as const

    install() {
        return {
            interceptors: [
                {
                    name: 'request-timing',
                    async intercept(context, next) {
                        const startedAt = Date.now()

                        try {
                            return await next()
                        } finally {
                            console.info('[request]', {
                                method: context.meta.method,
                                pathname: context.meta.pathname,
                                durationMs: Date.now() - startedAt,
                            })
                        }
                    },
                },
            ],
        }
    }
}

const apiRoute = createRoute({
    plugins: [new RequestTimingPlugin()],
})

export const GET = apiRoute({
    handler: (request) => ({
        method: request.method,
    }),
})
```

`install()` is called while the Factory or Route configuration is compiled.
The returned arrays are copied into an immutable configuration snapshot; the
plugin is not installed again for every request.

## What a plugin can contribute

| Contribution         | Use it for                                              |
| -------------------- | ------------------------------------------------------- |
| `middleware`         | request ID, logging, CORS, request-local setup          |
| `guards`             | authentication, authorization, API key checks           |
| `pipes`              | shared validation or input transformation               |
| `interceptors`       | timing, tracing, caching, response transformation       |
| `exceptionFilters`   | convert known exceptions to a safe `Response`           |
| `responseSerializer` | define the default serialization for plain Handler data |

The contribution object is the same shape as Factory configuration:

```ts
import { type RoutePlugin } from 'next-route-kit'

export class RequestPolicyPlugin implements RoutePlugin {
    readonly name = 'request-policy'
    readonly runtime = 'both' as const

    install() {
        return {
            middleware: [requestContextMiddleware],
            guards: [requireUser],
            pipes: [trimInputPipe],
            interceptors: [timingInterceptor],
            exceptionFilters: [domainExceptionFilter],
            responseSerializer: jsonResponseSerializer,
        }
    }
}
```

The component instances in this example are application-defined. The package
only owns their registration, ordering, runtime validation, and composition.
For request-specific mutable values, use `context.locals`; do not store them on
the plugin instance because one plugin instance can serve many requests.

## Register at the scope you need

Register cross-cutting policy once on a base Factory:

```ts
const apiRoute = createRoute({
    plugins: [new RequestTimingPlugin(), new RequestPolicyPlugin()],
})

const authenticatedRoute = apiRoute.extend({
    plugins: [new AuditPlugin()],
    guards: [requireUser],
})

export const GET = authenticatedRoute({
    use: [new RouteOnlyPlugin()],
    handler: handler,
})
```

There are three useful scopes:

- `createRoute({ plugins })`: shared by every Route created from that Factory;
- `factory.extend({ plugins })`: shared by a derived boundary such as an
  authenticated or admin area, without changing the parent;
- Route-local `use: [plugin]` or `plugins: [plugin]`: used by one Route only.

`use` is the concise Route-level spelling. `plugins` is also accepted on Route
options. Scope derivation is immutable, so a child plugin cannot be silently
added to its parent or to sibling Factories.

## Execution order

Plugin contributions are flattened into the same pipeline as directly declared
components. The request lifecycle is:

```text
Next params hydration
  → Middleware (enter, registration order)
  → Guard (registration order)
  → Interceptor (enter, registration order)
  → declared body/query resolvers
  → Pipe (field order, then registration order)
  → Handler(request, context)
  → Interceptor (exit, reverse order)
  → Middleware (exit, reverse order)
  → ResponseSerializer
```

Important details:

- Guards run before body/query resolution. A rejected request can avoid parsing
  an invalid or expensive body.
- Declared body and query resolvers are lazy and cached. When both are declared,
  their resolver work may start concurrently; do not rely on body resolving
  before query resolving.
- Pipes run after resolution. Each declared field passes through the pipe list
  in order.
- Middleware and Interceptors are nested. Code before `next()` runs in the
  displayed order; code after `await next()` runs in reverse order.
- A Guard can return a `Response` to short-circuit the Handler. Interceptors do
  not run for that short-circuit response.
- An error from any stage goes to ExceptionFilters. Route-local filters are
  tried before inherited filters; the first filter returning a `Response` wins.
- A native `Response` returned by a Handler bypasses the default serializer and
  is passed through unchanged.

For one Factory scope, direct component arrays are followed by contributions
from that scope's plugins. Scope arrays then compose from base Factory to
derived Factory to Route-local configuration. Exception filters are the
exception: the most local scope gets the first chance to handle an error.

## Runtime compatibility

Declare the runtime a plugin supports:

```ts
export class DatabaseAuditPlugin implements RoutePlugin {
    readonly name = 'database-audit'
    readonly runtime = 'nodejs' as const

    install() {
        return { middleware: [databaseAuditMiddleware] }
    }
}

const edgeRoute = createRoute({
    runtime: 'edge',
    plugins: [new DatabaseAuditPlugin()], // throws before a Route is served
})
```

Use `nodejs`, `edge`, or `both`. The Factory rejects an incompatible declared
plugin before serving requests. Next's own bundler and runtime restrictions
still apply.

## Serializer and error boundaries

Only one plugin-provided `responseSerializer` may exist in one configuration
layer; duplicate serializers from plugins in that layer are rejected during
configuration. A serializer from a more local Factory or Route, whether direct
or plugin-provided, overrides an inherited serializer. Exception filters are
composable and are the right place to turn a known error into a `Response`; use
`apiResponsePlugin()` when the application wants the standard
`{ code, msg, data }` contract.

If an application defines its own response protocol, configure its serializer
and exception filter together, preferably behind one application-owned plugin:

```ts
const applicationResponsePlugin: RoutePlugin = {
    name: 'application-response',
    install() {
        return {
            responseSerializer: numericResponseSerializer,
            exceptionFilters: [numericExceptionFilter],
        }
    },
}
```

The serializer controls successful plain values; it does not replace the
exception boundary. Registering only one of them can intentionally produce
different success and error formats, but most applications should keep the
two policies together.

## What this borrows from NestJS

The lifecycle is inspired by the useful part of NestJS's request model:
middleware prepares the request, guards decide admission, interceptors wrap
execution, pipes validate or transform inputs, and exception filters define the
error boundary. NestJS documents the same separation between guards, pipes,
interceptors, and filters.

The package deliberately stops before NestJS's application container. It does
not add controllers, decorators, module discovery, dependency injection, or a
second router. Next.js already owns route discovery and the native
`Request`/`Response` boundary, so an explicit Factory and immutable scopes keep
the composition visible and compatible with Node and Edge deployments.

`Factory.config` exposes the read-only plugin list and effective lifecycle
arrays. This makes the active scope inspectable without introducing a runtime
container or process-global registry.

Use direct `middleware`, `guards`, or other components when a policy is needed
once. Create a plugin when the policy has a name, is reused across scopes, or
needs to package several lifecycle contributions together.

See [Configuration and scopes](configuration.md), [Pipeline and errors](pipeline-and-errors.md),
and [API reference](api-reference.md) for the related contracts.
