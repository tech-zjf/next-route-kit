# API Reference

[English](../../en/user-guide/api-reference.md) · **简体中文**

本页说明应用开发者最常用的公开导出。最终类型契约以发布包生成的 TypeScript 声明为准。

## `createRoute`

```ts
createRoute<TState = Record<string, never>>(
    config?: RouteFactoryConfig<TState>,
): RouteFactory<TState>
```

`createRoute` 是可调用的 Root Factory。它接收配置对象，并返回一个可调用的 `route` Factory：

```ts
const route = createRoute({ response: jsonResponse() })
const GET = route({ handler: () => ({ ok: true }) })
```

`TState` 泛型描述 request-local state 的类型。Middleware 或 Guard 可以写入它，后续阶段读取它：

```ts
type State = { requestId: string }
const route = createRoute<State>({ middleware: [requestIdMiddleware] })
```

## `route(options)` 与 `Factory.create(options)`

```ts
route<TParams, TInput, TResult>(options: RouteOptions<TParams, TInput, TState, TResult>): NextRouteHandler<TParams>
```

同样的编译能力也可以通过 `factory.create(options)` 调用。Route Handler 文件推荐使用可调用形式。

### Handler Context

```ts
type RouteContext<TParams, TInput, TState> = {
    request: Request
    params: TParams
    input: TInput
    inputMetadata?: InputMetadata
    state: TState
    meta: RouteMeta
}
```

Handler 执行时 `params` 已经解析完成。`request` 是 Web API `Request`；`input` 是输入定义解析后的值；`state` 是 request-local state；`meta` 包含可选的 method、pathname 和 runtime 信息。

### Route 输入定义

`input` 支持以下形式：

| 形式       | 示例                                                | 结果                                         |
| ---------- | --------------------------------------------------- | -------------------------------------------- |
| 直接值     | `input: { source: 'cache' }`                        | 该值直接进入 Pipe 和 Handler。               |
| Resolver   | `input: ({ request }) => request.url`               | 在 Guard 后执行 resolver。                   |
| 单个输入源 | `input: jsonBody<Body>()`                           | 解析一个输入值。                             |
| Source Map | `input: { body: jsonBody<Body>(), query: query() }` | 每个输入源解析成一个字段，字面量字段会保留。 |

## `Factory.extend`

```ts
extend(config: RouteFactoryConfig<TState>): RouteFactory<TState>
```

返回不可变的子 Factory。数组按照合并规则追加；Error Mapper 按本地优先处理；本地 Serializer 会替换父级 Serializer。

## 输入辅助函数

| 导出                | 签名                         | 返回值                             |
| ------------------- | ---------------------------- | ---------------------------------- |
| `jsonBody`          | `jsonBody<T>()`              | 延迟解析的 `T` 类型 JSON Body。    |
| `body`              | `body<T>()`                  | `jsonBody<T>()` 的别名。           |
| `textBody`          | `textBody()`                 | 延迟读取的 `string` 类型 Body。    |
| `query`             | `query()`                    | 字符串值对象；重复键变成只读数组。 |
| `params`            | `params<TParams>()`          | 已解析的动态路由参数。             |
| `headers`           | `headers()`                  | Request Headers 的副本。           |
| `defineInputSource` | `(name, location, resolver)` | 自定义可复用 `InputSource`。       |

输入源带有 `name` 和 `body`、`query`、`params`、`headers`、`custom` 之一的 metadata `location`，Input Pipe 可以读取该信息。

## `jsonResponse`

```ts
jsonResponse<TContext = RouteContext>(options?: JsonResponseOptions<TContext>): ResponseSerializer
```

| 选项        | 类型                                          | 默认值 | 含义                                       |
| ----------- | --------------------------------------------- | ------ | ------------------------------------------ |
| `status`    | `number`                                      | `200`  | 普通序列化结果使用的 HTTP 状态码。         |
| `headers`   | `HeadersInit`                                 | 无     | 额外响应 Header。                          |
| `transform` | `(value, context) => value \| Promise<value>` | 原值   | 在 `Response.json` 前转换 Handler 返回值。 |

Handler 返回 `Response` 时绕过 Serializer。不要返回 `undefined`；请返回 JSON 值或原生 `Response`。

## 错误

```ts
new HttpError({
    status: 422,
    code: 'INVALID_USER',
    message: 'User data is invalid',
    details: { field: 'email' },
})
```

便捷构造函数：

```ts
unauthorized() // 401, UNAUTHORIZED
forbidden() // 403, FORBIDDEN
```

主包的默认 Mapper 会将 `HttpError` 序列化为：

```json
{
    "code": "UNAUTHORIZED",
    "message": "Authentication is required"
}
```

`jsonBody()` 或 `readBody()` 解析失败时，会返回 `400 INVALID_JSON` 的 `InvalidJsonBodyError` 响应。

## Pipeline 组件契约

所有组件都需要稳定的 `name`，用于诊断和调试。

```ts
type RouteMiddleware = {
    name: string
    handle(context, next): value | Promise<value>
}

type Guard = {
    name: string
    canActivate(context): boolean | Response | Promise<boolean | Response>
}

type InputPipe = {
    name: string
    transform(value, metadata, context): value | Promise<value>
}

type Interceptor = {
    name: string
    intercept(context, next): Promise<value>
}

type ErrorMapper = {
    name: string
    map(error, context): Response | undefined | Promise<Response | undefined>
}
```

## Runtime 与插件

```ts
type RouteRuntime = 'nodejs' | 'edge'
type RuntimeSupport = 'nodejs' | 'edge' | 'both'

type RoutePlugin = {
    name: string
    runtime?: RuntimeSupport
    install(): RoutePluginContribution
}
```

Factory 配置了 `runtime` 后，会检查插件声明的 Runtime。这只是提前诊断，不能替代 Next.js 的 Bundle 检查。

`install()` 可以返回以下贡献属性：

| 属性                 | 含义                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `middleware`         | 追加到当前作用域的 Middleware。                                                         |
| `guards`             | 追加到当前作用域的 Guard。                                                              |
| `inputPipes`         | 追加到当前作用域的 Input Pipe。                                                         |
| `interceptors`       | 追加到当前作用域的 Interceptor。                                                        |
| `errorMappers`       | 按正常本地优先规则追加 Error Mapper。                                                   |
| `responseSerializer` | 一个 Serializer 贡献；同一作用域多个插件提供时抛出 `DuplicateResponseSerializerError`。 |
