# next-route-kit 技术方案

## 结论

这个方向可做，但它不能被定位成完整后端框架，也不能替换 Next.js 的路由系统。

它只负责一件事：在不改变 App Router Route Handler 使用习惯的前提下，统一
大量 JSON API 中重复的请求级横切逻辑。业务 Service、数据库、流式响应、文件
上传、Webhook 原始签名、Cron Secret 和复杂任务仍由应用自己负责。

是否值得发布，以真实业务 Route 是否更容易读、更容易维护为准，而不是以抽象
数量或测试数量为准。

## 1. 问题验证与适用范围

大型 Next.js App Router 项目通常会在多个 `route.ts` 中重复请求级策略：
认证、Request ID、JSON Body 解析、输入校验、统一响应和异常转换。这些重复代码
会让同一项目的接口逐渐出现不同的执行顺序、错误结构和响应格式。

这并不意味着所有 Route 都适合抽象。首个可验证的价值区间是普通的 JSON CRUD
和认证 API；流式响应、Multipart、签名 Webhook、Cron 和长时间任务应继续使用
原生 Handler。采用本包前，建议从项目中挑选少量代表性 Route 做改造对比，确认
非业务代码减少且 Handler 更容易阅读，再扩大使用范围。

首个可验证的价值区间是：

1. 认证 API；
2. 统一 Request ID、日志和响应 Envelope；
3. JSON Body 的一次解析与校验；
4. 动态 Params、Query 和用户上下文的清晰传递；
5. 已知业务异常到 HTTP Response 的统一转换。

流式、Multipart、签名 Webhook、Cron 和长时间任务不应为了使用本包而改造。

## 2. 用户真正看到的 API

应用只需要创建一个普通的、显式导入的 Factory：

```ts
// src/server/routes.ts
export const apiRoute = createRoute({
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
    response: jsonResponse(),
}).withLocals(requestContextProvider)

export const authenticatedRoute = apiRoute.withLocals({
    name: 'session',
    async provide(context) {
        const session = await authenticate(context.request)
        if (!session) throw unauthorized()
        return { userId: session.userId }
    },
})
```

普通 Route Handler 保持 Request-first：

```ts
// app/api/resources/[id]/route.ts
export const GET = authenticatedRoute<{ id: string }>({
    handler: async (request, { params, locals }) => {
        const resource = await resourceService.find(params.id, locals.userId)

        return resource ?? new Response(null, { status: 404 })
    },
})
```

其中：

| 值      | 来源                         | 解决的问题                                            |
| ------- | ---------------------------- | ----------------------------------------------------- |
| request | 原生 Web Request             | Headers、URL、Cookie、流式 Body、原始请求仍可直接读取 |
| params  | Next 动态路由参数            | 不再每个 Handler 重复 await context.params            |
| locals  | Provider 建立的请求级上下文  | Request ID、userId、tenantId 等不再靠模糊的 state     |
| body    | 仅在 Route 声明 body 时提供  | 需要时统一解析 JSON，不需要时不增加抽象               |
| query   | 仅在 Route 声明 query 时提供 | 需要结构化 Query 时再使用，不强迫每个接口声明         |
| meta    | Factory 生成的只读元信息     | 方法、路径和运行时诊断                                |

没有使用 body 或 query 的 Route 不会被迫写空的参数声明。Headers 和 URL 仍然
从 request 上读取：

```ts
export const GET = authenticatedRoute({
    handler: async (request, { locals }) => {
        const url = new URL(request.url)
        return resourceService.list({
            userId: locals.userId,
            search: url.searchParams.get('search') ?? undefined,
        })
    },
})
```

## 3. 输入声明只在确实有价值时出现

创建或更新 JSON API 可以声明需要自动解析的 Body：

```ts
type CreateResourceInput = {
    title: string
    content: string
}

export const POST = authenticatedRoute({
    body: jsonBody<CreateResourceInput>(),
    handler: async (request, { body, locals }) => {
        const userAgent = request.headers.get('user-agent')
        return resourceService.create({ ...body, userId: locals.userId, userAgent })
    },
})
```

这不是把所有请求强行转换成 input。它只是把重复的 request.json()、一次性
Body 缓存和对应的校验挂到一个明确的 body 位置。

自动 Body Resolver 默认执行 1 MiB 字节上限；子作用域只能收紧上限。Zod 项目可以
用 `zodBody(schema)` 或 `zodQuery(schema)` 把解析、校验、转换和 Handler 类型绑定在
同一个声明中。

## 4. 分层和所有权

```text
Next.js app/**/route.ts
  ↓ 原生 Request/Response、动态 params
next-route-kit
  ↓ 只解析 Route 声明的 body/query，并映射 named context
@next-route-kit/core
  ↓ 生命周期、组件契约、插件 Registry
应用组件
  Middleware / Guard / Pipe / Interceptor / ExceptionFilter / Serializer
```

Factory 是 class-backed 的对象，调用语法由一个很薄的 callable Proxy 提供：

```ts
const publicRoute = createRoute(config)
const authenticatedRoute = publicRoute.extend({ guards: [requireUser] })
const GET = authenticatedRoute({ handler })
```

extend() 返回不可变子作用域，父 Factory 不会被修改。组件按
base → child → route-local 合并；继承的 Middleware 和 Guard 在 0.1.0 中不能被
静默移除，避免安全策略被某个 Route 的局部配置绕过。

不使用 next.config.ts 注入、不扫描目录、不使用进程级全局 Registry。应用可以
把 Factory 放在任意普通 server module 中；目录级策略通过显式导出的子 Factory
表达。

## 5. 请求生命周期

```text
Next params hydration
  → Middleware.use()
  → Guard.canActivate()
  → Interceptor.intercept() enter
  → declared body/query resolution
  → Pipe.transform() per declared argument
  → Handler(request, context)
  → Interceptor exit
  → Middleware exit
  → Response serialization

ExceptionFilter.catch() surrounds failures from the whole chain.
```

这个顺序采用常见服务端请求生命周期中的分层，并针对 Next Route Handler 做了
两处明确适配：

- Guard 在 Body 解析之前运行，未授权请求不会先消费非法 JSON；
- Interceptor 包住输入准备和 Handler，因此统一响应、耗时和异常边界是一致的。

Core 不知道 Next.js；Next 适配层负责 Promise params、输入源和原生 Response
边界。

## 6. 可插拔能力

Core 只提供稳定的组件契约：

- Middleware.use()
- Guard.canActivate()
- Pipe.transform()
- Interceptor.intercept()
- ExceptionFilter.catch()
- ResponseSerializer.serialize()
- RoutePlugin.install()

插件只能通过显式贡献 middleware、guards、pipes、interceptors、
exceptionFilters 或 responseSerializer 进入 Factory。Zod 作为独立的
@next-route-kit/zod 包，不进入 Core；未来可以按相同契约增加 Valibot 或自定义
适配器。

插件可以声明 nodejs、edge 或 both。Factory 在构建时做早期兼容性诊断，但不会
假装替应用检查 Edge Bundle 中的每一条 Node-only import。

## 7. Next.js 版本变化时的维护面

稳定边界只有：

- app/**/route.ts 方法导出；
- Web Request/Response；
- 动态 params；
- Node/Edge runtime 声明。

Next 版本变化时优先修改：

1. next-route-kit 的 adapter；
2. Next 15/16 compatibility fixtures；
3. 发布门禁和兼容性文档。

Core pipeline、插件契约和应用自己的 Factory 不应跟着 Next 版本全量重构。
包不依赖 Next 私有编译器 API、文件扫描、自定义 Router 或 next.config.ts
运行时注入。

## 8. 明确不做

- 不强迫每个 Route 写 params、body、query、headers 四类声明；
- 不让 Handler 失去原生 Request/Response；
- 不引入 Controller、Decorator、Module、DI 容器；
- 不把业务 Service 塞进 Handler pipeline；
- 不替应用决定错误码、Envelope 或验证库；
- 不制造一套脱离 Next 原生习惯的新开发流程；
- 不包装不适合的流式、文件、Webhook 和复杂任务 Route。

## 9. 发布验收门槛

只有同时满足下面条件，才值得发布正式版本：

1. 详情 GET、列表 GET、JSON POST、PATCH、DELETE 示例都保持 Next 原生可读；
2. 真实认证 Route 证明 Guard 早于 Body 解析；
3. Factory/extend() 能消除重复的 Request ID、鉴权、响应和异常配置；
4. Handler 仍然是 request + named context；
5. Core、Next adapter、Zod、testing 和 Next 15/16 fixtures 全部通过；
6. packed tarball 不包含 src、tests、fixtures 或 workspace 文件；
7. 中英文用户文档分目录、同页同步；
8. 代表性 CRUD/Auth Route 的改造前后，阅读路径更短且没有引入业务开发者
   不需要理解的额外概念。

## 10. 参考

- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
