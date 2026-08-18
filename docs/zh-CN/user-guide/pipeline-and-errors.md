# 链路、错误与响应

[English](../../en/user-guide/pipeline-and-errors.md) · **简体中文**

## 执行顺序

每个已编译的路由都遵循以下顺序：

```text
Next params hydration
  → Middleware
  → Guard
  → Input Resolver
  → Input Pipe
  → Interceptor
  → Handler
  → Response Serializer
```

这样设计的原因是：

- 动态 params 在读取 Body 前就可以用于权限判断；
- Guard 可以拒绝未授权请求而不解析输入；
- Input Pipe 接收已解析输入，并且可以转换它；
- Interceptor 包裹 Handler，可以观察最终值；
- Serializer 在 Handler 完成后处理普通返回值。

## Middleware

Middleware 可以写入 request-local state，并且需要调用 `next()` 才会继续：

```ts
import type { AnyRouteContext, RouteMiddleware } from 'next-route-kit'

type State = { requestId: string }

const requestIdMiddleware: RouteMiddleware<AnyRouteContext<State>> = {
    name: 'request-id',
    async handle(context, next) {
        context.state.requestId = crypto.randomUUID()
        return next()
    },
}
```

Middleware 可以返回 `Response` 提前结束，但不能重复调用 `next()`。重复调用会抛出 `DuplicateMiddlewareNextError`。

## Guard

Guard 在 `input` 解析前执行：

```ts
import { unauthorized, type AnyRouteContext, type Guard } from 'next-route-kit'

const requireUser: Guard<AnyRouteContext> = {
    name: 'require-user',
    canActivate({ request }) {
        if (!request.headers.get('authorization')) {
            throw unauthorized()
        }

        return true
    },
}
```

返回 `false` 会生成默认的 `403 FORBIDDEN`。缺少身份时抛出 `unauthorized()`（401），身份存在但没有权限时使用 `forbidden()`（403）。Guard 也可以返回原生 `Response`，以自定义响应并提前结束。

Guard 可以读取 hydrate 后的 `context.params`、`request` 和 request-local state，但不应假设 `context.input` 已经解析完成。

## Input Pipe

Input Pipe 会接收当前输入、来源 metadata 和 context：

```ts
const trimName = {
    name: 'trim-name',
    transform(value: { name: string }) {
        return { name: value.name.trim() }
    },
}
```

Pipe 按注册顺序执行，每个 Pipe 接收前一个 Pipe 的输出。需要 Schema 校验时可以使用 `@next-route-kit/zod`。

## Interceptor

Interceptor 包裹后续阶段，通常应等待并返回 `next()`：

```ts
const timing = {
    name: 'timing',
    async intercept(context, next) {
        const startedAt = Date.now()
        const result = await next()
        console.info(context.meta.pathname, Date.now() - startedAt)
        return result
    },
}
```

多个 Interceptor 注册时，进入顺序是注册顺序，退出顺序相反。

## Error Mapper

Error Mapper 处理自己负责的错误并返回 `Response`，其他错误返回 `undefined`：

```ts
const applicationErrors = {
    name: 'application-errors',
    map(error: unknown) {
        if (error instanceof ApplicationError) {
            return Response.json({ code: error.code, message: error.message }, { status: error.status })
        }

        return undefined
    },
}
```

查找顺序为：

```text
Route → Scope → Global → 内置默认 Mapper
```

默认 Mapper 处理 `HttpError` 和非法 JSON。未知异常会继续抛给 Next.js，而不会由库直接暴露内部错误细节。

## Response Serializer

默认 Serializer 规则如下：

| Handler 返回值       | 行为                        |
| -------------------- | --------------------------- |
| `Response`           | 原样返回。                  |
| JSON 兼容值          | 使用 `Response.json` 转换。 |
| `undefined`          | 抛出 `TypeError`。          |
| Stream、Blob 或 File | 必须显式返回 `Response`。   |

使用 `jsonResponse({ transform, status, headers })` 定义统一响应结构：

```ts
const route = createRoute({
    response: jsonResponse({
        transform: (data) => ({ code: 0, data }),
    }),
})
```

Handler 已经返回的 `Response` 不会被二次包装。
