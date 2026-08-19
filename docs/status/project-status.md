# Project Status

Last updated: 2026-08-19

## Current state

```text
Project: next-route-kit
Phase: local release candidate complete; maintainer publication steps pending
Status: full local release gate passed
Product gate: package is useful only for repeated JSON CRUD/Auth Route policy
Next checkpoint: run remote CI, confirm npm name/scope, then maintainer decides whether to publish
Publication: no commit, push, or npm publish performed in this cycle
```

## 本轮已经完成

### 产品方向

- 明确它不是完整后端框架，不替换 Next Router；
- 明确只处理 Route Handler 的请求级横切逻辑；
- 保留原生 Request/Response 和 app/**/route.ts；
- 不使用 next.config.ts 注入、不扫描目录、不使用进程级全局注册；
- 复杂业务、流、上传、Webhook、Cron 和长任务保持原生实现；
- 确认重复主要集中在认证、Body、异常和响应等请求级横切策略。

### 公共 API

当前稳定方向：

```ts
export const POST = authenticatedRoute({
    body: jsonBody<CreateResourceInput>(),
    handler: async (request, { body, locals }) => {
        return resourceService.create({
            userId: locals.userId,
            userAgent: request.headers.get('user-agent'),
            ...body,
        })
    },
})
```

已固定：

- request-first Handler；
- named context：params、locals、meta、可选 body/query；
- 不要求每个 Route 写空的 params/body/query/headers；
- locals 取代含义模糊的 state；
- Pipe 取代早期的输入管道命名；
- ExceptionFilter 取代早期的错误映射命名；
- Middleware.use、Guard.canActivate、Pipe.transform、Interceptor.intercept；
- class-backed Factory 和 immutable extend()；
- 输入解析位于 Guard 之后、Interceptor 内；
- Zod 只在 @next-route-kit/zod；
- testing helpers 只在 @next-route-kit/testing。
- 可选的 `apiResponsePlugin()` 提供统一 `{ code, msg, data }` 契约；业务码由应用维护，
  `ApiException` 只负责把业务异常带到 Route 边界；原生 `Response` 仍然透传。

### 测试和适配层

已完成并通过定向验证：

- Core lifecycle、plugin Registry；
- Next Route Factory；
- Zod adapter；
- runner-neutral testing package；
- authenticated resource flow；
- success、unauthorized、malformed body、validation error；
- Next 15/16 Node/Edge fixtures；
- params、query、JSON body、原生 Response；
- packed consumer 公共导出边界。

## 当前架构决策

| 决策                                      | 状态                                  |
| ----------------------------------------- | ------------------------------------- |
| 包名使用 next-route-kit                   | 暂定，发布前仍需确认 npm 名称和 scope |
| 使用 createRoute(config) 创建 Factory     | 已接受                                |
| Factory 使用 class-backed callable shell  | 已接受                                |
| 使用 extend() 派生不可变作用域            | 已接受                                |
| 全局策略由应用普通 server module 显式导入 | 已接受                                |
| 不强制特殊命名的 route 配置文件           | 已接受                                |
| 不从 next.config.ts 注入运行时策略        | 已接受                                |
| Handler 使用 request + named context      | 已接受                                |
| body/query 可选声明                       | 已接受                                |
| 继承的安全组件 0.1.0 不可静默移除         | 已接受                                |
| Core 不依赖 Next.js/Zod                   | 已接受                                |
| Next 版本适配集中在 adapter 和 fixtures   | 已接受                                |

## 本轮门禁结果

- docs:check：通过，55 个 Markdown 文件和 11 个双语用户页面；
- Prettier：通过；
- ESLint：通过，0 warning；
- typecheck：通过，6 个 workspace package；
- test：通过，Core、主包、testing 和 Zod 测试全部通过；
- build：通过，Core、adapter、Zod、testing 和 Next 15/16 fixtures；
- verify:packed：通过，4 个公开包的实际 tarball 边界和外部 consumer；
- verify:next:prod：通过，Next 15.5.23、16.3.1 Node/Edge HTTP smoke；
- verify:next:dev：通过，Next 15/16 Turbopack development HTTP smoke；
- git diff --check：通过；
- npm tarball：只包含 dist、README、CHANGELOG、LICENSE 和 package.json。

Next.js 构建仍有已记录的框架警告：Next 15 fixture 未启用 Next ESLint plugin，
Next 16 报告 Edge Runtime deprecated。这些不是 package 失败，详见
[兼容性矩阵](../compatibility/next-matrix.md)。

## 外部发布事项

本地代码和门禁已经完成，但以下事项需要维护者的外部操作：

1. commit 并 push 到 main；
2. 观察 GitHub CI matrix；
3. 确认 next-route-kit、@next-route-kit scope 的 npm 名称和权限；
4. 配置 NPM_TOKEN 和受保护的 npm-release environment；
5. 维护者显式批准 Release workflow；
6. 发布后将 npm 版本、tag、CI URL 写回本文件。

这些操作本轮没有执行。

补充审计记录：只读查询确认四个公开包目前尚未出现在 npm registry；`pnpm audit --prod`
报告的 3 个 high、2 个 moderate 漏洞全部来自私有 Next 15 fixture 的 `next` 传递依赖
（`sharp`/`postcss`），四个公开包的实际 tarball 不包含 Next 或这些依赖。该问题不阻断
npm 包发布，但在仓库层面仍应在后续升级 fixture 或明确接受风险前保持记录。

## 产品成功标准

不能用“有测试”替代“有人会用”。首个真实试点应选择 10 个普通
JSON CRUD/Auth Route，比较改造前后：

- 非业务代码行数中位数至少减少 20%；
- 每个 Route 不再重复认证、通用 try/catch 和 Envelope；
- Handler 仍保持 Next 开发者熟悉的 request-first；
- 不引入开发者不需要的 Controller、Module、Decorator、DI；
- 业务开发者能直接理解 Route、Service、鉴权和返回值；
- 不强行改造流、上传、Webhook、Cron 和长任务。

达不到这个门槛，就应收缩包的定位或停止发布，而不是继续增加抽象。

## 更新协议

每个 checkpoint 都要记录：

- 当前 Phase 和状态；
- 修改的文件或包；
- 实际执行的测试和门禁；
- 新增、保留或撤销的架构决策；
- 未验证风险；
- 下一步具体动作。

架构变化同步修改 docs/architecture/decisions/ 下的 ADR。

## Activity log

### 2026-08-19 — Optional adapter response boundary and release review

- 明确主包不依赖、不注册 Zod；Zod 校验和 `zodExceptionFilter()` 保持在可选适配包中；
- 为 `apiResponsePlugin()` 增加通用 `mapError`，可把任意可选适配器异常映射回统一的
  `{ code, msg, data }` 契约，避免独立 Filter 覆盖统一响应结构；
- 双语 README、统一响应指南、输入校验指南、API Reference、Zod 包 README 和 ADR 已同步说明
  两种互斥错误边界的选择方式；
- 重绘中英文请求链路图，准确表达 `Interceptor enter → Resolver → Pipe → Handler → Interceptor exit`；
- 修正发布文档中的当前测试数量表述，删除首发基线中会触发额外版本 bump 的 API response changeset；
- 完整 `release:check` 通过，包含文档、lint、typecheck、全部 package tests、构建、packed consumer、
  Next.js 15/16 production 与 Turbopack smoke。

### 2026-08-19 — Route parameter type compatibility fix

- 修复 `RouteParams` 索引签名导致 `interface Params` 无法传给 Route Factory 的公开类型问题；
- 将公开泛型约束改为兼容 `interface` 的参数约束，保留默认 `RouteParams` 结构以及
  `string | string[] | undefined` 的字段校验，并同步覆盖 Core、主包输入源、testing helpers 和内部 Factory 类型；
- 增加主包 Factory 与 testing helpers 的 interface 参数类型回归覆盖；
- `typecheck`、全部 package tests、ESLint 已通过，修复后的完整 `release:check` 已通过。

### 2026-08-18 — Final release review and generic examples

- 将 README、用户指南、架构示例和主包测试中的具体详情资源统一改为泛化的
  `resources/:id` / `Resource` 命名，避免让示例绑定某一种业务领域；
- 复核 Core Pipeline、Next Route Factory、插件 Registry、API 响应插件、Zod 适配器、
  testing helpers、npm tarball 边界以及 Next 15/16 fixtures；
- 本地发布门禁保持通过：全部 package tests、严格类型检查、ESLint、Prettier、构建、packed
  consumer 和 Next 15/16 production/Turbopack smoke；
- 确认本轮仍未执行 commit、push 或 npm publish；实际发布仍需维护者完成 npm 权限、
  GitHub CI 和受保护 Release workflow 操作。

### 2026-08-18 — Plugin documentation and coverage

- 在根目录中英文 README 增加可直接复制的 class-based 自定义插件示例；
- 完善双语插件指南，说明贡献项、基础 Factory、`extend()`、Route-local `use`、执行顺序、
  异常边界、serializer 和 Node/Edge 兼容性；
- 增加自定义插件真实 Factory 链路测试，验证插件贡献的 Middleware/Interceptor 进入实际请求链。

### 2026-08-18 — Public naming and package cleanup

- 将统一响应码公开命名收敛为 `ResponseCode` 和 `ResponseCodeDefinition`，异常实例使用
  `responseCode` 字段；
- 清理用户文档、测试、fixtures、CI 和维护文档中的旧业务示例、旧候选包名及外部项目痕迹；
- 保留根目录 README 的核心使用路径，把架构决策和发布记录留在维护者文档中；
- 重新通过完整 `release:check`，包含 Markdown 校验、全部 package tests、打包消费者以及 Next 15/16
  的生产与开发 HTTP 冒烟验证。

### 2026-08-18 — Native API refactor

- 将 handler 统一为 request-first；
- 移除每个 Route 强制声明 input 的设计；
- body/query 改为按需声明；
- 将 state 改为 locals；
- 将早期输入管道、输入元数据和错误映射命名统一为
  Pipe、ArgumentMetadata、ExceptionFilter；
- 修正生命周期为 Middleware → Guard → Interceptor → Input Resolver → Pipe → Handler；
- 增加真实 authenticated resource flow，而不是只测试裸 Factory；
- 同步 Next 15/16 fixtures、Zod、testing package 和双语用户文档。

### 2026-08-18 — Route suitability review

- 梳理大型 App Router 项目中常见的认证、解析、错误和响应重复模式；
- 识别适用的 JSON CRUD/Auth Route；
- 将流、上传、Webhook、Cron、长任务列为明确边界；
- 增加改造前后阅读路径和试点验收标准。

### 2026-08-18 — Release candidate gate

- 修复 Next 15 generated route type 被同步 params overload 污染的问题；
- 修复 Next 16 fixture 错误导入 route 的问题；
- 修复无 body/query Route 误运行全局 Pipe 的问题，并增加回归测试；
- 统一 Next 15/16 resource fixture 的 resourceId 契约，使 smoke test 验证 locals.userId；
- 修复 Next smoke script 的 production/dev 错误文案，并显式绑定 127.0.0.1；
- 通过完整 release:check；
- 记录 48 个 package tests、packed consumer、Next 15/16 production 和 Turbopack
  development smoke 结果。

### 2026-08-18 — Release-prep review

- 修复自定义 Body/Query resolver 的 ArgumentMetadata，使按位置匹配的 Pipe 不会失效；
- 修正 README、双语用户文档、真实链路测试和 Next 15/16 fixture 中的统一响应拦截器，
  原生 Response 会保留状态码、响应头和响应体；
- 移除主包中没有合法 Route 挂载位置的 `params()`、`headers()` helper，Params、Header、
  URL 和 Cookie 保持在原生 context/Request 上；
- 移除 Next 15/16 fixture 中已弃用的 `baseUrl` 配置，保留 `paths` 别名，避免 TypeScript 7
  迁移时产生配置警告；
- 增加以上两类回归测试，当前 package tests 共 50 个；
- 重新通过 typecheck、lint、Prettier、docs:check、build、packed consumer、Next 15/16
  production 和 Turbopack development smoke；
- 只读确认四个 npm 包名尚未发布，scope 所有权和 GitHub Release 环境仍需维护者确认。

### 2026-08-18 — API response contract review

- 梳理企业 API 常见的响应码、`ApiException`、全局 Filter/Interceptor/Pipe、
  手写响应和客户端错误分流模式；确认统一业务码、统一 Envelope 和 Route 级重复
  `try/catch` 是可复用的通用需求；
- 新增 `ApiException`、`ApiResponsePlugin`、统一成功/异常 Envelope、未知异常兜底、
  `mapData`/`mapErrorData` 和原生 Response 透传；
- 新增 5 个主包 API Contract 测试，并把成功、未登录和业务异常追加到真实 authenticated
  resource flow，覆盖成功、业务异常、系统异常、列表数据和原生 Response；
- 新增中英文用户指南、根 README 使用摘要、包 README 和 Changeset；
- 通过完整 `release:check`（含 lint、typecheck、全部 package tests、build、packed consumer、
  Next 15/16 production/Turbopack smoke 和 Prettier）；
- 保留边界：包不替前端决定 Toast/Dialog，业务码和前端处理器仍由应用维护；流、上传、
  Webhook、Cron 和长任务不强制迁移。

### 2026-08-17 — Factory and repository baseline

- 建立 pnpm workspace、包边界、Core/adapter 分层；
- 采用 class-backed immutable Factory；
- 采用显式 plugin Registry 和 extend()；
- 建立 Next compatibility fixtures、Changesets、Husky、CI 和 release gate；
- 将包测试从 src 移到 package/tests。
