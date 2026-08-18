# 配置与作用域

[English](../../en/user-guide/configuration.md) · **简体中文**

`next-route-kit` 使用显式配置。没有隐藏的全局 Registry、目录扫描或自动注入 `next.config.ts`。

## Factory 配置

```ts
const route = createRoute<State>({
    runtime: 'nodejs',
    plugins: [],
    middleware: [],
    guards: [],
    inputPipes: [],
    interceptors: [],
    errorMappers: [],
    responseSerializer: jsonResponse(),
})
```

| 属性                 | 类型                 | 作用                                                  |
| -------------------- | -------------------- | ----------------------------------------------------- |
| `runtime`            | `'nodejs' \| 'edge'` | 声明 Factory 使用的 Runtime，并用于插件兼容性诊断。   |
| `plugins`            | `RoutePlugin[]`      | 在当前 Factory 作用域安装插件贡献，每个插件安装一次。 |
| `middleware`         | `RouteMiddleware[]`  | 在 Guard 前执行，可写入 request-local state。         |
| `guards`             | `Guard[]`            | 在解析路由输入前准入或拒绝请求。                      |
| `inputPipes`         | `InputPipe[]`        | 校验或转换已解析的输入。                              |
| `interceptors`       | `Interceptor[]`      | 包裹 Handler，可观察或转换 Handler 结果。             |
| `errorMappers`       | `ErrorMapper[]`      | 将已知错误转换成 `Response`。                         |
| `responseSerializer` | `ResponseSerializer` | 将普通 Handler 返回值转换成 `Response`。              |
| `response`           | `ResponseSerializer` | `responseSerializer` 的面向用户别名。                 |

所有属性都是可选的。主包会提供 JSON Response Serializer，并追加处理 `HttpError` 和非法 JSON 的默认 Mapper。

## Route 参数

```ts
const GET = route({
    runtime: 'edge',
    input: query(),
    use: [],
    middleware: [],
    guards: [],
    inputPipes: [],
    interceptors: [],
    errorMappers: [],
    response: jsonResponse(),
    handler: ({ input }) => input,
})
```

| 属性                              | 类型                                         | 必填 | 作用                                    |
| --------------------------------- | -------------------------------------------- | :--: | --------------------------------------- |
| `handler`                         | `(context) => value \| Promise<value>`       |  是  | Route Handler 的业务逻辑。              |
| `input`                           | 直接值、resolver、Input Source 或 Source Map |  否  | 在 Middleware 和 Guard 后解析路由输入。 |
| `use`                             | `RoutePlugin[]`                              |  否  | 路由级 `plugins` 的简写。               |
| `runtime`                         | `'nodejs' \| 'edge'`                         |  否  | 覆盖继承的 Runtime 目标。               |
| `middleware`                      | `RouteMiddleware[]`                          |  否  | 在继承的 Middleware 后追加。            |
| `guards`                          | `Guard[]`                                    |  否  | 在继承的 Guard 后追加。                 |
| `inputPipes`                      | `InputPipe[]`                                |  否  | 追加路由级 Input Pipe。                 |
| `interceptors`                    | `Interceptor[]`                              |  否  | 追加路由级 Interceptor。                |
| `errorMappers`                    | `ErrorMapper[]`                              |  否  | 追加拥有最高优先级的路由级 Mapper。     |
| `responseSerializer` / `response` | `ResponseSerializer`                         |  否  | 替换该路由继承的 Serializer。           |

`route(options)` 返回一个函数，可以直接从 `route.ts` 导出为 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD` 或 `OPTIONS`。

## 使用 `extend` 创建业务作用域

```ts
const route = createRoute({
    middleware: [requestIdMiddleware],
})

const authenticatedRoute = route.extend({
    guards: [requireUserGuard],
})

const adminRoute = authenticatedRoute.extend({
    guards: [requireAdminGuard],
})
```

`extend` 不会修改父 Factory。可以用它创建 `publicRoute`、`authenticatedRoute`、`adminRoute` 和 `internalRoute` 等应用级策略。

## 合并规则

| 组件                | 生效顺序或规则                                                         |
| ------------------- | ---------------------------------------------------------------------- |
| Middleware          | Global → Scope → Route，按此顺序追加并执行。                           |
| Guards              | Global → Scope → Route，按此顺序追加并执行。                           |
| Input Pipes         | Global → Scope → Route，按此顺序追加并执行。                           |
| Interceptors        | 进入顺序为 Global → Scope → Route，退出时反向展开。                    |
| Error Mappers       | Route → Scope → Global → 内置默认 Mapper，第一个返回 Response 的生效。 |
| Response Serializer | 最近一层显式 Serializer 替换继承值。                                   |
| Plugins             | 按注册顺序安装，继承的插件安装结果会复用。                             |
| Runtime             | 最近一层显式 Runtime 会与所有组合插件做兼容性校验。                    |

在 `0.1.0` 中不能移除或禁用继承组件。如果某个路由需要不同安全策略，应创建具有明确策略的独立 Factory，而不是给共享 Factory 增加 opt-out 参数。

## 什么不是全局配置

这里的“全局”只针对使用同一个 Factory 的路由生效。包不会自动对仓库内所有 `route.ts` 应用配置。这种显式边界可以保证 Serverless、Edge、Turbopack 和未来 Next.js Bundler 下的行为稳定。
