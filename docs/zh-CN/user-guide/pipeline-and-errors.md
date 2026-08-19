# 链路、错误与响应

[English](../../en/user-guide/pipeline-and-errors.md) · **简体中文**

## 执行顺序

```text
Next params hydration
  → Middleware.use()
  → Guard.canActivate()
  → Interceptor.intercept() enter
  → 声明的参数解析
  → Pipe.transform()
  → Handler
  → Interceptor 退出
  → Response 序列化

异常由 ExceptionFilter.catch() 处理。
```

这条顺序采用清晰的服务端请求生命周期，同时保留 Next 原生的
Request/Response 边界。

## Middleware

```ts
const requestId: RouteMiddleware<ApiContext> = {
    name: 'request-id',
    use(context, next) {
        context.locals.requestId = crypto.randomUUID()
        return next()
    },
}
```

Middleware 包裹后续执行，必须调用 `next()`；重复调用会抛出
`DuplicateMiddlewareNextError`。

## Guard

```ts
const requireUser: Guard<ApiContext> = {
    name: 'require-user',
    canActivate(context) {
        if (!context.request.headers.get('authorization')) {
            throw unauthorized()
        }
        return true
    },
}
```

Guard 可以返回 `false`、原生 `Response` 或抛出 `HttpError`，并且在
Body/Query 解析前执行。

## Interceptor

```ts
const envelope: Interceptor<ApiContext> = {
    name: 'envelope',
    async intercept(context, next) {
        const value = await next()

        if (value instanceof Response) {
            return value
        }

        return { data: value, requestId: context.locals.requestId }
    },
}
```

`next()` 之前是进入阶段，`await next()` 之后是退出阶段。
如果下游 Handler 返回原生 `Response`，应直接透传，否则状态码、响应头和响应体会被
错误地包进统一 JSON 响应。

## Exception Filter

```ts
const filter: ExceptionFilter<ApiContext> = {
    name: 'api-errors',
    catch(error, context) {
        if (!(error instanceof HttpError)) return undefined
        return Response.json({ code: error.code, message: error.message, requestId: context.locals.requestId }, { status: error.status })
    },
}
```

Filter 按 Route 局部到外层作用域尝试。返回 `undefined` 会交给下一个
Filter。默认 Filter 处理内置 `HttpError` 和非法 JSON。

默认 JSON 响应会包含 `HttpError.details`，统一响应插件也会把
`ApiException.data` 放进响应。因此这两者都属于客户端可见数据，不要放入密钥或
内部诊断信息；内部信息应交给 `onUnknownError` 或服务端日志。

## Response

普通值使用 `jsonResponse()`。原生 `Response` 原样返回，流、文件、跳转和
`204` 不需要特殊适配 API。
