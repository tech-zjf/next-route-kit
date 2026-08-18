# @next-route-kit/core

Framework-neutral request lifecycle contracts and plugin registry for
next-route-kit.

```bash
npm install @next-route-kit/core
```

Application users normally install `next-route-kit`. Use Core when authoring
plugins or another Web Request/Response adapter.

The stable stages are:

```text
Middleware → Guard → Interceptor (enter) → Pipes → Handler
→ Interceptor (exit) → Response serialization
```

`ExceptionFilter.catch()` can convert errors from the whole chain.
`RouteContext` contains the native `request`, hydrated `params`,
request-local `locals`, and an adapter-owned `args` store. The Next adapter
maps resolved arguments into named handler context properties, so normal
application routes do not expose `args`.

## Plugin contract

```ts
import type { RoutePlugin } from '@next-route-kit/core'

export class RequestLogPlugin implements RoutePlugin {
    readonly name = 'request-log'
    readonly runtime = 'both' as const

    install() {
        return {
            middleware: [
                {
                    name: 'request-log',
                    async use(context, next) {
                        const startedAt = Date.now()
                        const result = await next()
                        console.info(context.request.method, context.meta.pathname, Date.now() - startedAt)
                        return result
                    },
                },
            ],
        }
    }
}
```

Contributions use `middleware`, `guards`, `pipes`, `interceptors`,
`exceptionFilters`, and an optional `responseSerializer`. The registry
installs plugins explicitly, freezes contribution snapshots, composes child
scopes without reinstalling parent plugins, and validates declared Node/Edge
compatibility.

Core does not import Next.js, scan routes, provide dependency injection, or
choose a validation library.
