# 配置与作用域

[English](../../en/user-guide/configuration.md) · **简体中文**

## 应用级作用域

```ts
const apiRoute = createRoute<ApiLocals>({
    middleware: [requestContext],
    guards: [requireApiKey],
    pipes: [trimInput],
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
    response: jsonResponse(),
})
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

组合顺序是：

```text
base Factory → derived Factory → route-local config
```

Middleware、Guard、Pipe、Interceptor 按顺序追加。Exception Filter 按 Route
局部到继承作用域的顺序尝试。Route 自己的 response serializer 会覆盖继承值。

## 选项

| 选项               | 用途                       |
| ------------------ | -------------------------- |
| `runtime`          | 声明 Node/Edge 插件兼容性  |
| `plugins`          | 注册可复用贡献             |
| `middleware`       | 外层处理和请求级初始化     |
| `guards`           | 鉴权与权限                 |
| `pipes`            | Body/Query 校验和转换      |
| `interceptors`     | 响应封装、耗时、缓存、追踪 |
| `exceptionFilters` | 把错误转换成 `Response`    |
| `response`         | JSON serializer 简写       |
| `body`             | 可选 Route Body 解析器     |
| `query`            | 可选 Route Query 解析器    |
| `handler`          | 业务函数                   |

配置是显式的。包不会扫描目录、修改进程级全局注册表，也不需要特殊配置文件。

## 全局不等于所有地方都一样

基础 Factory 只放真正所有接口共享的策略。鉴权和 admin 用
`extend()` 派生；只在一个接口使用的行为留在 Route 文件中，让阅读者能在
使用位置看见它。
