# 编写插件

[English](../../en/user-guide/plugins.md) · **简体中文**

插件是实现框架无关 Core 契约的普通对象。Factory 作用域编译时会安装插件贡献；插件实例不应该持有 request-local 可变状态。

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

显式注册插件：

```ts
import { createRoute } from 'next-route-kit'
import { RequestLogPlugin } from './request-log-plugin'

export const route = createRoute({
    plugins: [new RequestLogPlugin()],
})
```

## 插件规则

- 保持安装过程确定且可重复理解。
- 将请求状态写入 `context.state`，不要写到插件实例上。
- 准确声明 `runtime: 'nodejs'`、`'edge'` 或 `'both'`。
- Edge 兼容插件入口不能导入 Node-only 模块。
- 只返回 Core 支持的贡献属性。
- 每个贡献都提供稳定的 `name`。
- Middleware 和 Guard 不要读取 `context.input`，输入会在后面解析。
- 不依赖进程级全局注册或文件系统扫描。

插件测试可以使用 `@next-route-kit/testing` 的 `createTestPlugin()` 或简单对象 double。
