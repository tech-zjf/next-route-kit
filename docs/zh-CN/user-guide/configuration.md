# 配置与作用域

[English](../../en/user-guide/configuration.md) · **简体中文**

## 应用级作用域

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

从 `apiRoute` 创建的所有 Route 都会继承这套策略。

## 派生作用域

```ts
const authenticatedRoute = apiRoute.extend({
    guards: [requireUser],
})

const adminRoute = authenticatedRoute.extend({
    guards: [requireAdmin],
})
```

`extend()` 是不可变的。父 Factory 不会被修改，因此 public Route 不会意外继承
admin Guard。

## 带运行时保证的 Locals

需要让后续 Handler 获得必填的身份或租户字段时，使用 Provider 的实际返回值派生类型：

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

Provider 位于 Guard 阶段，在自动 Body 解析前运行。只有 Provider 成功返回后，Handler
才会执行，因此 `locals.userId` 和 `locals.organizationId` 是必填类型。不要只通过
`createRoute<RequiredLocals>()` 声明运行时没有建立的字段。

组合顺序是：

```text
base Factory → derived Factory → route-local config
```

Middleware、Guard、Pipe、Interceptor 按顺序追加。Exception Filter 按 Route
局部到继承作用域的顺序尝试。Route 自己的 response serializer 会覆盖继承值。

## 选项

| 选项               | 用途                      |
| ------------------ | ------------------------- |
| `runtime`          | 声明 Node/Edge 插件兼容性 |
| `maxBodyBytes`     | 自动 Body 读取上限        |
| `nativeResponse`   | 透传或拒绝原生 Response   |
| `plugins`          | 注册可复用贡献            |
| `middleware`       | 包住完整链路的外层处理    |
| `guards`           | 鉴权与权限                |
| `pipes`            | Body/Query 校验和转换     |
| `interceptors`     | 输入/Handler 结果高级处理 |
| `exceptionFilters` | 把错误转换成 `Response`   |
| `response`         | JSON serializer 简写      |
| `body`             | 可选 Route Body 解析器    |
| `query`            | 可选 Route Query 解析器   |
| `handler`          | 业务函数                  |

配置是显式的。包不会扫描目录、修改进程级全局注册表，也不需要特殊配置文件。

## 全局不等于所有地方都一样

基础 Factory 只放真正所有接口共享的策略。鉴权和 admin 用
`extend()` 派生；只在一个接口使用的行为留在 Route 文件中，让阅读者能在
使用位置看见它。
