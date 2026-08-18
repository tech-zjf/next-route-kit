# Writing plugins

[简体中文](../../zh-CN/user-guide/plugins.md) · **English**

Plugins are ordinary objects that implement the framework-neutral Core
contract. They install their contributions when a Factory scope is compiled;
they should not hold request-local mutable state.

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
                    async handle(context, next) {
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

Register it explicitly:

```ts
import { createRoute } from 'next-route-kit'
import { RequestLogPlugin } from './request-log-plugin'

export const route = createRoute({
    plugins: [new RequestLogPlugin()],
})
```

## Plugin rules

- Keep installation deterministic.
- Keep request state on `context.state`, not on the plugin instance.
- Declare `runtime: 'nodejs'`, `'edge'`, or `'both'` accurately.
- Do not import Node-only modules from an Edge-compatible plugin entrypoint.
- Return only contribution properties supported by Core.
- Give every contribution a stable `name`.
- Do not read `context.input` in Middleware or Guard; input is resolved later.
- Do not rely on process-global registration or filesystem discovery.

For plugin tests, use `createTestPlugin()` from
`@next-route-kit/testing` or a small object double.
