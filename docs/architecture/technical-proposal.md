# next-route-kit 技术方案

## 1. 文档信息

| 项目         | 内容                               |
| ------------ | ---------------------------------- |
| 项目名称     | `next-route-kit`                   |
| 当前状态     | Architecture baseline completed    |
| 目标框架     | Next.js App Router                 |
| 首发能力     | Route Handler Pipeline             |
| 首发 Runtime | Node.js；Core 保持 Edge-compatible |
| 许可证       | MIT                                |
| 主要语言     | TypeScript                         |
| 发布方式     | pnpm workspace + Changesets        |

## 2. 结论

方案可行，架构方向正确，但必须将产品边界定义为：

> 不改变 Next.js 文件路由的 Route Handler 工程化 Pipeline。

它不是 NestJS for Next，也不是新的 Router。它只负责把重复的请求级横切逻辑组合起来：

```text
Request
  -> Context
  -> Middleware
  -> Guard
  -> Input Validation / Transformation
  -> Interceptor
  -> Handler
  -> Response Serialization
  -> Response
```

整体采用：

```text
Framework-neutral Core
  +
Next.js Adapter
  +
Application-owned Route Factory
  +
Optional Plugins
```

这个分层可以把未来 Next.js 的变化限制在 Adapter 和兼容性测试中，而不是迫使整个 Pipeline 重构。

## 3. Next.js 兼容性边界

Next.js Route Handler 的公开契约包括：

- 在 `app` 目录中使用 `route.ts`；
- 导出 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`；
- 接收 Web `Request` / `NextRequest`；
- 返回 Web `Response` / `NextResponse`；
- 动态路由 `context.params` 为 Promise；
- Catch-all 参数可能是数组。

参考：[Next.js `route.js` API](https://nextjs.org/docs/app/api-reference/file-conventions/route)

因此，用户代码仍然保持：

```ts
// app/api/users/route.ts
import { route } from '@/server/routes'

export const POST = route({
    handler: async ({ input, state }) => {
        return userService.create(input.body, state.user)
    },
})
```

### 3.1 不依赖的内容

Core 不依赖：

- Next.js 内部模块；
- Next.js 编译器私有 API；
- `globalThis` 全局 Route Registry；
- 文件系统扫描；
- 自定义服务器；
- 自定义路由匹配；
- `middleware.ts` / `proxy.ts` 的内部实现。

### 3.2 `proxy.ts` 不属于 MVP

Next.js 16 将 `middleware.ts` 更名为 `proxy.ts`，并规定 Proxy 使用 Node.js Runtime，Runtime 不能由文件配置。旧版本与新版本在此处存在差异。[Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

Proxy 是请求到达 Route Handler 之前的网络边界，适合重定向、Rewrite、Header 和轻量级前置判断，不适合作为完整业务请求 Pipeline。[Next.js Proxy Guide](https://nextjs.org/docs/app/getting-started/proxy)

因此：

```text
Route Handler Pipeline != Proxy Pipeline
```

后续如果需要支持 Proxy，单独设计 `@next-route-kit/proxy`，不污染 Core。

## 4. 为什么不把配置注册到 `next.config.ts`

Next.js 官方将 `next.config.ts` 定义为构建和服务器阶段加载的 Node.js 配置模块，而不是请求级 Route Handler 容器。[Next.js Configuration](https://nextjs.org/docs/pages/api-reference/config/next-config-js)

如果把运行时插件实例直接注册到 `next.config.ts`，会带来：

- 构建阶段和请求阶段生命周期混淆；
- Node-only 插件可能被错误带入 Edge Route；
- Serverless 环境中全局状态不可靠；
- 热更新可能导致重复注册；
- Turbopack / Webpack 升级时需要维护编译器注入逻辑；
- 业务路由难以进行单独测试。

### 4.1 推荐方案

使用应用自己的 Route Factory：

```ts
// src/server/routes/index.ts
import { createRoute, jsonResponse } from 'next-route-kit'

export const route = createRoute({
    plugins: [requestId(), requestLogger()],
    response: jsonResponse(),
    errorMappers: [httpErrorMapper(), defaultErrorMapper()],
})
```

### 4.2 `next.config.ts` 的可选职责

未来可以提供：

```ts
import { withRouteKit } from 'next-route-kit/config'

export default withRouteKit({
    reactStrictMode: true,
})
```

但它只负责：

- 配置检查；
- Next.js 版本检查；
- Runtime 兼容性诊断；
- Route Factory 使用检查；
- 构建期 Manifest 或报告。

它不负责运行时自动注入 Guard、Pipe 或 Interceptor。

Next.js 16 虽然提供了实验性的 Build Adapter 能力，但该能力属于构建扩展而不是稳定的 Route Handler 全局钩子，不作为 MVP 的运行时基础。[Next.js `adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath)

## 5. 配置层级

配置层级为：

```text
Global Route Factory
  ↓
Business Scope Factory
  ↓
Route Config
  ↓
Handler-local Config
```

### 5.1 全局配置

```ts
export const route = createRoute({
    plugins: [requestId(), requestLogger(), tracing()],
    response: jsonResponse(),
    errorMappers: [validationErrorMapper(), httpErrorMapper(), defaultErrorMapper()],
})
```

### 5.2 业务域配置

```ts
export const authenticatedRoute = route.extend({
    plugins: [requireUser()],
})

export const adminRoute = authenticatedRoute.extend({
    plugins: [requireAdmin()],
})
```

### 5.3 Factory API 语义

`createRoute()` 是 Factory 构造函数，不是一次性导出单个 HTTP 方法的函数：

```ts
// 任意业务目录均可创建 Factory
const route = createRoute({
    plugins: [requestLogger()],
    response: jsonResponse(),
})

// 返回的 route 函数用于定义具体 Route Handler
export const GET = route({
    handler: async () => {
        return { ok: true }
    },
})
```

实现上，Factory 使用 class 承载配置快照、插件安装、`extend()` 派生和
Pipeline 编译；`createRoute` 是一个可调用的 Root Factory 实例。可调用
Proxy 只负责保留短小的调用体验，不承担全局注册表或请求状态：

```ts
export const createRoute = new Factory({}, 'root')
const route = createRoute({ middleware: [requestLogger()] })
const GET = route({ handler: () => ({ ok: true }) })
```

Core 的 `RoutePipeline` 也使用 class。旧的 `executeRoutePipeline()` 仅保留
为兼容性外观，新的适配层应在 Route Handler 创建时编译并复用 Pipeline。

Factory 不直接承担插件贡献的扁平化细节，而是组合 Core 的
`RoutePluginRegistry`：Registry 负责显式安装插件、保存安装结果、按注册顺序
聚合贡献，并在派生 Scope 时复用父级安装结果。这样可以把“Factory 的配置
作用域”和“插件的安装所有权”分开，后续增加插件资源释放或运行时能力校验时，
不需要重写 Route Pipeline。

这个方向借鉴了 Cordis 对 Context、Registry、Service、Fiber 和生命周期
所有权的拆分，但不复制其全局服务注册、运行时依赖热重载、装饰器和代理
上下文注入模型，避免扩大 Next.js 的兼容边界。

配置模块可以位于：

```text
src/server/routes/index.ts
app/api/admin/route-config.ts
src/features/users/routes.ts
```

项目不强制要求 `route-infra.config.ts` 这个文件名。它可以作为团队约定，但不是运行时发现机制。

### 5.4 路由级配置

```ts
export const POST = authenticatedRoute({
    input: {
        body: createUserInput(),
    },
    use: [auditLog()],
    handler,
})
```

输入源也可以直接组合成一个路由输入对象，不需要在每个 Handler 里重复
读取 Request：

```ts
import { headers, jsonBody, params, query } from 'next-route-kit'

export const POST = authenticatedRoute({
    input: {
        body: jsonBody<CreateUserInput>(),
        query: query(),
        params: params<{ id: string }>(),
        headers: headers(),
    },
    handler: ({ input }) => userService.update(input.params.id, input.body),
})
```

`input` 支持三种形式：直接值、单个输入 resolver，以及由
`InputSource` 组成的对象。对象可以混合输入源和字面量字段；输入源对象会在
路由编译时做浅快照，避免后续修改声明对象影响已导出的 Handler。内置源包括
`jsonBody()`/`body()`、`textBody()`、`query()`、`params()` 和
`headers()`；扩展能力通过 `defineInputSource()` 提供，不依赖 Zod 或其他
校验库。

### 5.5 目录级配置

不根据路径运行时扫描。使用显式的目录级 Factory：

```text
src/server/routes/
├── index.ts
├── admin.ts
├── public.ts
└── internal.ts
```

```ts
// src/server/routes/admin.ts
import { route } from './index'

export const adminRoute = route.extend({
    plugins: [requireUser(), requireAdmin()],
})
```

这样目录归属仍然清晰，但不会依赖 Next.js 编译器或服务器文件系统。

## 6. 配置合并规则

| 配置                | 规则                                       |
| ------------------- | ------------------------------------------ |
| Middleware          | Global → Scope → Route，追加执行           |
| Guards              | Global → Scope → Route，追加执行           |
| Input Pipes         | Global → Scope → Route，追加执行           |
| Interceptors        | Global → Scope → Route，进入顺序；退出反向 |
| Error Mappers       | Route → Scope → Global，首个匹配者处理     |
| Response Serializer | Route 覆盖 Scope，Scope 覆盖 Global        |
| Runtime             | 取所有插件能力交集                         |
| State               | 通过 Factory 逐层扩展                      |
| Plugin              | 按注册顺序安装                             |

同一个配置层内如果多个插件都提供 `responseSerializer`，Registry 会直接报错；
显式的 Route/Scope/Global 配置仍按上表覆盖。这样可以避免插件注册顺序悄悄
决定最终响应格式。

Global 插件默认不能被路由关闭。安全相关插件可以声明：

```ts
requireUser({ mandatory: true })
```

避免某个路由因为局部配置而意外绕过安全策略。

## 7. Pipeline 生命周期

```text
Create Context
  ↓
Resolve params and route input source
  ↓
Global Route Middleware
  ↓
Scope Route Middleware
  ↓
Local Route Middleware
  ↓
Global Guards
  ↓
Scope Guards
  ↓
Local Guards
  ↓
Interceptors Before
  ↓
Input Validation / Transformation
  ↓
Business Handler
  ↓
Interceptors After
  ↓
Response Serialization
```

异常路径：

```text
Any Stage Throws
  ↓
Interceptor Catch / Rethrow
  ↓
Route Error Mapper
  ↓
Scope Error Mapper
  ↓
Global Error Mapper
  ↓
Default Error Mapper
```

参数解析和 `input` resolver 属于请求准备阶段，发生在 Middleware/Guard
之前，但同样位于 Pipeline 的统一错误边界内；因此 Promise reject、Body
解析失败和输入 resolver 抛错都会进入 Error Mapper。请求准备只在路由声明
需要输入时触发，未声明输入的 GET 不会主动读取 Body。

### 7.1 Guard 语义

建议优先抛出明确错误：

```ts
throw unauthorized()
throw forbidden()
```

不要只使用 `false -> 403`，因为未登录通常是 401，权限不足才是 403。

### 7.2 Interceptor 语义

Interceptor 适合：

- 计时；
- 日志；
- 链路追踪；
- 缓存；
- 超时；
- 对结果进行非破坏性处理。

统一 JSON 响应不应该作为 Interceptor 的主要职责，而应由 Response Serializer 负责。

## 8. 公开命名

### 8.1 包命名

推荐：

```text
next-route-kit              # 普通用户安装的主包
@next-route-kit/core        # 插件作者和高级用户
@next-route-kit/zod         # 可选 Zod 适配器
@next-route-kit/testing     # 测试工具
```

`next-route-kit` 比 `next-route-infra` 更短、更像开发者工具包，也不会暗示项目要替代 Next.js Router。

发布前仍需单独确认 npm 和 GitHub 名称可用性。

### 8.2 API 命名

| 原始概念                | 最终公开命名                             | 说明                                  |
| ----------------------- | ---------------------------------------- | ------------------------------------- |
| 单个 Route Handler 包装 | `createRoute`                            | 语义直接                              |
| 应用级配置 Factory      | `createRoute`                            | 返回可复用的 `route(options)` Factory |
| 可选配置辅助            | `defineRouteConfig`                      | 用于类型约束，不是基础用法必需        |
| 请求上下文              | `RouteContext`                           | 行业通用                              |
| Middleware              | `RouteMiddleware` / `use`                | 避免与 Next `middleware.ts` 混淆      |
| Guard                   | `Guard`                                  | 适合鉴权和准入判断                    |
| Pipe                    | `InputPipe`                              | 仅作为高级/内部术语                   |
| 输入校验                | `validateBody`、`validateQuery`、`input` | 普通用户不必理解 Pipe                 |
| Interceptor             | `Interceptor`                            | 表达前后包裹行为                      |
| Error Handler           | `ErrorMapper`                            | 表达错误到响应的映射                  |
| Response Writer         | `ResponseSerializer`                     | 更准确地表达数据序列化                |
| Plugin                  | `RoutePlugin`                            | 生态常用词                            |
| Scope                   | `extend`                                 | 不可变组合                            |

## 9. 核心类型

```ts
export type RuntimeSupport = 'nodejs' | 'edge' | 'both'

export type RouteParams = Record<string, string | string[]>

export interface RouteContext<TParams extends RouteParams = RouteParams, TInput = unknown, TState = Record<string, never>> {
    request: Request
    params: TParams
    input: TInput
    state: TState
    meta: RouteMeta
}
```

Runtime 能力主要通过插件静态声明。`RouteContext` 不要求 Core 自己检测 Node 或 Edge。

### 9.1 Route Handler

```ts
export interface RouteOptions<TParams extends RouteParams = RouteParams, TInput = unknown, TState = Record<string, never>, TResult = unknown> {
    input?: InputDefinition<TInput>
    use?: readonly RouteUse[]
    handler: RouteHandler<TParams, TInput, TState, TResult>
}
```

### 9.2 Guard

```ts
export interface Guard<TState = unknown> {
    readonly name: string

    canActivate(context: RouteContext<any, any, TState>): boolean | Response | Promise<boolean | Response>
}
```

### 9.3 Input Pipe

```ts
export interface InputPipe<TInput = unknown, TOutput = TInput> {
    readonly name: string

    transform(value: TInput, metadata: InputMetadata, context: RouteContext): TOutput | Promise<TOutput>
}
```

### 9.4 Interceptor

```ts
export interface Interceptor {
    readonly name: string

    intercept(context: RouteContext, next: () => Promise<unknown>): Promise<unknown>
}
```

### 9.5 Error Mapper

```ts
export interface ErrorMapper {
    readonly name: string

    map(error: unknown, context: RouteContext): Response | undefined | Promise<Response | undefined>
}
```

### 9.6 Response Serializer

```ts
export interface ResponseSerializer<TValue = unknown> {
    readonly name: string

    serialize(value: TValue, context: RouteContext): Response | Promise<Response>
}
```

## 10. Response 设计

默认 Response Serializer 的规则：

```text
Response 实例 → 直接透传
JsonValue → 使用 Response.json()
Stream / Blob / File → 要求显式返回 Response
undefined → 默认报错，避免隐式语义
```

全局统一响应示例：

```ts
jsonResponse({
    transform: (value, context) => ({
        code: 0,
        data: value,
        requestId: context.state.requestId,
    }),
})
```

文件下载或流式接口可以直接返回：

```ts
return new Response(stream, {
    headers: {
        'content-type': 'application/octet-stream',
    },
})
```

框架不得二次包装已经存在的 `Response`。

## 11. Request Body 设计

Request Body 是一次性流。框架不能让不同插件重复调用：

```ts
await request.json()
```

输入解析必须支持懒加载和缓存：

```ts
input: {
  body: validateBody(schema),
}
```

内部流程：

```text
首次读取 body
  ↓
读取 Request Stream
  ↓
解析内容
  ↓
执行校验
  ↓
缓存结果
  ↓
后续读取复用结果
```

未声明 Body 输入的 GET Route Handler 不应被框架主动读取请求体或 headers。

这是为了减少对 Next.js 动态渲染和缓存行为的无意影响。Next.js 会根据是否访问请求数据判断 Route Handler 是否可以预渲染或继续使用缓存能力。

当前 Next 适配层提供无校验库依赖的输入源基础：

```ts
input: {
    body: jsonBody<CreateUserInput>(),
    query: query(),
    params: params<{ id: string }>(),
    headers: headers(),
}
```

`jsonBody()` 和 `textBody()` 共享同一个懒加载的 Request 文本 Promise；同一
请求内重复读取不会再次消费流。`query()` 将重复键保留为只读数组，
`headers()` 返回 Request Headers 的副本，避免 Handler 修改输入时影响原始
Request。校验规则由后续的输入 Pipe 或可选适配包提供，Core 不内置具体校验库。

## 12. Runtime 设计

### 12.1 Core

只使用 Web Standard API，目标支持：

- Node.js；
- Edge Runtime；
- Vercel；
- Cloudflare；
- 其他兼容 Web API 的部署环境。

### 12.2 Node-only 插件

数据库驱动、文件系统、Node-only OpenTelemetry 等插件声明：

```ts
runtime: 'nodejs'
```

### 12.3 Edge 插件

Edge 插件不得导入：

- `fs`；
- `net`；
- `tls`；
- `child_process`；
- Node-only 数据库驱动；
- Node-only 加密接口。

### 12.4 配置隔离

Node 和 Edge 路由不能强制共享同一个包含 Node-only 插件的 Factory：

```text
src/server/routes/node.ts
src/server/routes/edge.ts
```

Core 可共享，Factory 配置按 Runtime 分开。

## 13. 自动 OPTIONS 的边界

如果 `route.ts` 没有导出 `OPTIONS`，Next.js 可以自动生成 OPTIONS 响应。这个自动生成的响应不会经过 `next-route-kit` 的 Route Factory。

因此，需要统一处理 CORS 或 OPTIONS 的项目应显式导出：

```ts
export const OPTIONS = route({
    handler: () => new Response(null, { status: 204 }),
})
```

这是 Next.js 的平台行为，不通过私有 API 强行覆盖。

## 14. 插件模型

```ts
export interface RoutePlugin {
    readonly name: string
    readonly runtime?: RuntimeSupport

    install(): RoutePluginContribution
}

export interface RoutePluginContribution {
    middleware?: readonly RouteMiddleware[]
    guards?: readonly Guard[]
    inputPipes?: readonly InputPipe[]
    interceptors?: readonly Interceptor[]
    errorMappers?: readonly ErrorMapper[]
    responseSerializer?: ResponseSerializer
}
```

插件安装由 Core 的 `RoutePluginRegistry` 持有：

```ts
const registry = new RoutePluginRegistry(plugins)
const contribution = registry.snapshot()
const child = registry.extend(additionalPlugins)
```

Registry 的约束是：

- 一个 Registry 实例内每个插件只安装一次；
- 子 Registry 复用父级已安装贡献，只安装新增插件；
- 贡献按显式注册顺序聚合；
- 不存在进程级单例或导入时自动注册；
- 请求状态不放入 Registry，仍然由每次 Route Handler 调用创建。

插件约束：

- 显式注册；
- 无自动扫描；
- 无导入时副作用；
- 声明 Runtime；
- 不修改其他插件状态；
- 只依赖公开契约；
- 不直接依赖 Next.js 私有模块。

## 15. 包划分

```text
next-route-kit
  面向普通用户的 Next.js 入口包

@next-route-kit/core
  Pipeline、类型和插件契约

@next-route-kit/zod
  可选 Zod 适配器

@next-route-kit/testing
  Route Handler 和 Pipeline 测试工具
```

后续候选：

```text
@next-route-kit/valibot
@next-route-kit/otel
@next-route-kit/auth
@next-route-kit/eslint
@next-route-kit/openapi
```

第一版不单独发布 `plugin-json`，因为普通 JSON 响应属于 Next 入口包的基础能力。`class-validator` 也不进入 MVP，避免第一版被装饰器和 Node-only 兼容问题绑住。

## 16. 仓库结构

```text
next-route-kit/
├── apps/
│   ├── docs/
│   ├── example-next15/
│   └── example-next16/
├── packages/
│   ├── next-route-kit/
│   ├── core/
│   ├── zod/
│   └── testing/
├── examples/
│   ├── basic/
│   ├── global-config/
│   ├── scoped-routes/
│   ├── custom-response/
│   ├── custom-error/
│   └── runtime/
├── docs/
│   ├── architecture/
│   ├── implementation/
│   └── status/
├── tests/
│   ├── conformance/
│   ├── fixtures/
│   ├── runtime/
│   └── type-tests/
├── scripts/
├── .changeset/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── vitest.config.ts
├── playwright.config.ts
├── README.md
└── LICENSE
```

## 17. 兼容性策略

默认支持最近两个 Next.js Major 版本。首个兼容矩阵目标：

```text
Next.js 15 + Node.js
Next.js 15 + Edge-compatible Core
Next.js 16 + Node.js
Next.js 16 + Edge-compatible Core
```

Next.js 16 默认使用 Turbopack，并要求 Node.js 20.9 或更高版本；因此必须有真实的 Next.js 16 fixture，而不是只做 TypeScript 编译。[Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

未来 Next.js 升级时的适配顺序：

```text
1. 更新 compatibility fixture
2. 运行 Route Handler conformance tests
3. 修改 next-route-kit Adapter
4. 重新检查 exports 和 Runtime Bundle
5. 更新兼容性文档
6. 只有 Core 契约被破坏时才调整 Core
```

## 18. 测试和验收

必须覆盖：

- Global / Scope / Route 配置顺序；
- Guard 短路；
- Input Pipe 转换；
- Interceptor 洋葱模型；
- Error Mapper 首个匹配；
- Response 透传；
- JSON Response Serializer；
- Request Body 单次解析；
- Catch-all Params；
- `params` Promise；
- 显式 OPTIONS；
- Node / Edge 构建；
- Next.js 15 / 16 构建；
- Turbopack 构建；
- 发布包脱离 Monorepo 安装；
- 第三方插件只依赖公开类型。

## 19. 主要风险和应对

| 风险                       | 应对                                        |
| -------------------------- | ------------------------------------------- |
| Next.js 内部变化           | Core 与 Adapter 分离                        |
| 全局状态污染               | 不使用可变 Registry                         |
| Response 被二次包装        | Response 直接透传                           |
| Body 被多次读取            | 懒加载和缓存                                |
| Edge 引入 Node 依赖        | Runtime 元数据 + Fixture 构建               |
| 目录作用域隐式失控         | 使用显式 Child Factory                      |
| NestJS 术语阻碍 Next 用户  | 用户侧优先使用 `input`、`use` 和语义 helper |
| 全局插件影响 GET 缓存      | 文档明确请求访问和动态化副作用              |
| 自动 OPTIONS 绕过 Pipeline | 需要统一处理时显式导出 OPTIONS              |

## 20. 最终决策

本方案进入实现阶段，采用以下固定边界：

```text
项目名：next-route-kit
主包：next-route-kit
Core：@next-route-kit/core
配置：独立 Route Factory 模块
next.config.ts：仅构建集成
Proxy：MVP 外置
Server Actions：MVP 外置
自动扫描：不支持
Core：不依赖 Next.js
Next 变化：优先只修改 Adapter 和 Fixture
```
