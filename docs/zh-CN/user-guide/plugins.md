# 插件

[English](../../en/user-guide/plugins.md) · **简体中文**

插件用于封装可复用的请求策略。插件必须显式注册到 Factory 或某个 Route，包不会
使用进程级全局注册表，也不会扫描文件系统。

## 自定义一个插件

实现 `RoutePlugin`，并在 `install()` 中返回要贡献的链路组件。下面这个插件会给
Factory 作用域下的每个 Handler 记录耗时：

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

`install()` 在 Factory 或 Route 配置编译时执行。返回的数组会被复制并放入不可变的
配置快照，后续每次请求不会重新安装插件。

## 插件可以贡献什么

| 贡献项               | 适用场景                            |
| -------------------- | ----------------------------------- |
| `middleware`         | Request ID、日志、CORS、请求初始化  |
| `guards`             | 鉴权、权限、API Key 检查            |
| `pipes`              | 通用校验或输入转换                  |
| `interceptors`       | 耗时、链路追踪、缓存、响应转换      |
| `exceptionFilters`   | 把已知异常转换成安全的 `Response`   |
| `responseSerializer` | 定义普通 Handler 返回值的默认序列化 |

贡献对象和 Factory 配置使用相同的结构：

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

上例中的具体组件由业务项目自己实现。包只负责注册、排序、运行时兼容性检查和组合。
请求级可变数据应该写入 `context.locals`，不要放在插件实例的属性上，因为同一个插件
实例可能服务多个请求。

## 按作用域注册

全局共享策略只注册在基础 Factory 一次：

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
    handler,
})
```

有三种常用作用域：

- `createRoute({ plugins })`：该 Factory 创建的所有 Route 都继承；
- `factory.extend({ plugins })`：只对派生边界生效，例如已登录或 admin 区域，且不会修改父 Factory；
- Route 局部的 `use: [plugin]` 或 `plugins: [plugin]`：只对当前 Route 生效。

`use` 是 Route 层更简短的写法，Route options 也支持 `plugins`。作用域派生是不可变的，
子作用域不会悄悄修改父作用域或兄弟 Factory。

## 执行顺序

插件贡献的组件会和直接写在 Factory/Route 配置中的组件合并到同一条链路：

```text
Next params hydration
  → Middleware（进入，按注册顺序）
  → Guard（按注册顺序）
  → Interceptor（进入，按注册顺序）
  → 声明的 Body/Query Resolver
  → Pipe（先按字段，再按注册顺序）
  → Handler(request, context)
  → Interceptor（退出，逆序）
  → Middleware（退出，逆序）
  → ResponseSerializer
```

需要特别注意：

- Guard 在 Body/Query 解析之前执行，未通过鉴权的请求不会先解析非法或昂贵的 Body；
- 已声明的 Body 和 Query Resolver 是惰性的并且会缓存结果；两者同时声明时，解析可能并发开始，
  不要依赖 Body 一定先于 Query 完成；
- 解析完成后执行 Pipe，每个声明的字段都会按 Pipe 注册顺序依次转换；
- Middleware 和 Interceptor 都是嵌套调用。`next()` 之前的代码按图示顺序执行，`await next()` 之后
  的代码按逆序执行；
- Guard 可以返回 `Response` 直接短路，此时 Handler 和 Interceptor 都不会执行；
- 任意阶段抛出的异常都会进入 ExceptionFilter。Route 局部 Filter 优先于继承的 Filter，
  第一个返回 `Response` 的 Filter 获胜；
- Handler 返回原生 `Response` 时会绕过默认 serializer，原样透传。

同一个作用域内，直接声明的组件会排在该作用域插件贡献的组件之前；不同作用域按基础 Factory →
派生 Factory → Route 局部配置合并。ExceptionFilter 例外：越局部的作用域越先处理异常。

## 运行时兼容性

插件可以声明自己支持的运行时：

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
    plugins: [new DatabaseAuditPlugin()], // 在提供请求前就会抛错
})
```

可选值是 `nodejs`、`edge` 或 `both`。Factory 会在提供请求前拒绝不兼容的插件；Next 自己的
bundler 和运行时限制仍然有效。

## Serializer 与异常边界

同一个配置层内最多只能有一个插件提供 `responseSerializer`，同层重复配置会在配置阶段抛错。
更局部的 Factory 或 Route 直接配置或通过插件提供 `response`/`responseSerializer` 时，会覆盖继承的
serializer。ExceptionFilter 可以组合，适合把已知异常转成 `Response`；如果项目需要统一
`{ code, msg, data }` 契约，可以直接使用 `apiResponsePlugin()`。

只使用一次的策略直接写 `middleware`、`guards` 等配置即可；当策略有明确名称、会跨多个作用域复用，
或需要把多个生命周期组件打包在一起时，再抽成插件。

相关内容：[配置与作用域](configuration.md)、[链路、错误与响应](pipeline-and-errors.md)、
[API Reference](api-reference.md)。
