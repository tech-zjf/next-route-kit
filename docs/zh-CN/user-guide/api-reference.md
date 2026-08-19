# API Reference

[English](../../en/user-guide/api-reference.md) · **简体中文**

## Factory

```ts
const route = createRoute<TLocals>(config?)
const child = route.extend(config)
const handler = route<TParams, TBody, TQuery, TResult>(options)
```

`createRoute` 返回一个 class-backed、可调用的 `Factory`。结果可直接作为
Next App Router 的方法导出。

`TParams` 可以使用普通的 `type` 类型别名，也可以使用 `interface`。不提供
Route 参数类型时，则使用默认的 `RouteParams` 结构。

## Route 选项

```ts
type RouteOptions = {
    runtime?: 'nodejs' | 'edge'
    middleware?: RouteMiddleware[]
    guards?: Guard[]
    pipes?: Pipe[]
    interceptors?: Interceptor[]
    exceptionFilters?: ExceptionFilter[]
    plugins?: RoutePlugin[]
    use?: RoutePlugin[]
    response?: ResponseSerializer
    responseSerializer?: ResponseSerializer
    body?: RouteInputDefinition<TBody>
    query?: RouteInputDefinition<TQuery>
    handler: (request: Request, context: RouteHandlerContext) => unknown
}
```

大多数接口只需要 `handler`。只有希望包自动解析并缓存值时，才增加
`body` 或 `query`。

没有动态 Params 时，`jsonBody<T>()` 和 `query<T>()` 可以直接推导类型，不需要
Route 泛型。动态 Params 与带类型的 Body/Query 同时出现时，按
`route<TParams, TBody, TQuery, TResult>` 的顺序显式提供泛型。

## Handler Context

```ts
type RouteHandlerContext = {
    params: TParams
    locals: TLocals
    meta: RouteMeta
    body?: TBody
    query?: TQuery
}
```

声明对应 Route 选项后才会出现 `body`、`query`。Handler 的第一个参数始终
是原生 `Request`。

## 内置解析器

| 解析器                        | 结果                           |
| ----------------------------- | ------------------------------ |
| `jsonBody<T>()` / `body<T>()` | 延迟解析 JSON                  |
| `textBody()`                  | 延迟读取文本                   |
| `query<T>()`                  | Query Map，重复 Key 变成数组   |
| `defineInputSource()`         | 可复用的 Body/Query 延迟解析器 |

Params 直接使用 `context.params`，Header、URL 和 Cookie 直接从原生
`request` 上读取，不需要额外的 helper 声明。

## 组件契约

```ts
type RouteMiddleware = {
    name: string
    use(context, next): unknown | Promise<unknown>
}

type Guard = {
    name: string
    canActivate(context): boolean | Response | Promise<boolean | Response>
}

type Pipe = {
    name: string
    transform(value, metadata, context): unknown | Promise<unknown>
}

type Interceptor = {
    name: string
    intercept(context, next): unknown | Promise<unknown>
}

type ExceptionFilter = {
    name: string
    catch(error, context): Response | undefined | Promise<Response | undefined>
}
```

`ArgumentMetadata.type` 为 `body`、`query`、`params`、`headers` 或
`custom`。Pipe 可以据此忽略不属于自己的参数。

## 统一 API 响应契约

```ts
const apiRoute = createRoute({
    plugins: [
        apiResponsePlugin({
            success: ResponseCode.SUCCESS,
            systemError: ResponseCode.INTERNAL_ERROR,
            mapError: (error, context) => {
                // 可选适配器可以在这里映射自己的异常。
                return undefined
            },
        }),
    ],
})

throw new ApiException(ResponseCode.RESOURCE_NOT_FOUND, {
    data: { resourceId },
})
```

`apiResponsePlugin()` 会贡献成功响应 Interceptor 和异常 Exception Filter，统一
输出 `{ code, msg, data }`，并使用配置的 `systemError` 兜底未知异常；原生
`Response` 仍然直接透传。`ResponseCodeDefinition` 包含 `code`、`msg` 和可选的 HTTP
`status`；`ApiException` 支持可选的 `message`、`data`、`status`、`cause` 覆盖值。
完整契约和迁移示例见[统一 API 响应指南](api-response.md)。

`mapError(error, context)` 是可选配置，返回 `undefined` 或应用自己的错误映射：

```ts
type ApiResponseErrorMapping = {
    code: ResponseCodeDefinition
    status?: number
    message?: string
    data?: Readonly<Record<string, unknown>>
}
```

它就是适配器边界。例如，可选的 Zod 包可以在这里映射
`ZodValidationError`，主包不需要依赖 Zod。独立的 Zod ExceptionFilter 则是另一种
选择，适用于不使用统一 API 外壳的 Route。
