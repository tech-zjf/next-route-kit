# Implementation Plan

这份文档是 next-route-kit 的可执行进度表。每次完成一个可验证 checkpoint，
必须同步更新 docs/status/project-status.md；架构决策变化必须追加或修改 ADR。

## 状态说明

- pending：尚未开始
- in_progress：正在执行
- completed：退出条件已验证
- blocked：连续三次相同外部阻塞，无法继续

## Phase 0 — 产品和架构边界

Status: completed

已完成：

- 确认包只服务 Next.js App Router Route Handler 的请求级横切逻辑；
- 确认不替换 Next Router、不扫描目录、不注入 next.config.ts；
- 确认显式的 createRoute(config) 和不可变 extend() Factory；
- 确认 Core 与 Next adapter 分离；
- 梳理大型 App Router 项目中的通用重复模式和不适用 Route；
- 建立 ADR 和技术方案。

退出证据：

- [技术方案](../architecture/technical-proposal.md) 明确了边界；
- 代表性链路测试和适用边界已经写入测试与用户指南。

## Phase 1 — 仓库基础设施

Status: completed

已完成：

- pnpm workspace、Turborepo、TypeScript、Vitest；
- ESLint、Prettier、Husky、lint-staged；
- Changesets、MIT License、CI 和受保护 Release workflow；
- 包的 exports、files、engines、README、CHANGELOG；
- 测试文件从 src 移到 package/tests。

退出证据：

- package build、typecheck、test 可独立运行；
- npm pack 边界检查拒绝 src、tests、fixtures 和 workspace 文件；
- pre-commit 只格式化和检查暂存文件。

## Phase 2 — 公共 API 重构

Status: completed

本轮已固定的用户契约：

- Handler：handler(request, { params, locals, meta, body?, query? })；
- 原生 Request 永远是第一个参数；
- body、query 可选，只声明实际需要的输入；
- request.headers、request.url、原始 Response 保持原生用法；
- state 改为 locals；
- 早期输入管道命名改为 Pipe；
- 早期错误映射命名改为 ExceptionFilter；
- Middleware 方法改为 use；
- 早期输入元数据命名改为 ArgumentMetadata；
- 保留 class-backed Factory 和 extend()。

退出证据：

- Core、Next adapter、Zod、testing 的源码、类型和测试全部使用新契约；
- 文档、README、fixtures 和 packed consumer 不再展示旧的 input/state API。

## Phase 3 — Core 请求生命周期

Status: completed

固定顺序：

```text
Next params hydration
  → Middleware.use()
  → Guard.canActivate()
  → Interceptor enter
  → declared body/query resolution
  → Pipe.transform()
  → Handler
  → Interceptor exit
  → Middleware exit
  → Response serialization

ExceptionFilter.catch() surrounds the whole chain.
```

已验证：

- Guard 可以在 Body 解析前拒绝请求；
- Body 和 text 只读取一次；
- Pipe 按 body/query 等 ArgumentMetadata 处理；
- Interceptor 可以包住输入准备和 Handler；
- Middleware 可以短路或转换后续结果；
- 原生 Response 不会被重复序列化；
- 解析异常、HttpError 和业务异常进入 ExceptionFilter。

## Phase 4 — Next adapter 和 immutable Factory

Status: completed

已完成：

- createRoute(config) root Factory；
- Factory class-backed callable shell；
- route(options) 和 extend(config)；
- Promise/object params 归一化；
- body、textBody、query、params、headers、defineInputSource；
- lazy body/text cache；
- route-local options；
- Node/Edge runtime compatibility diagnostics；
- default JSON serializer 和原生 Response passthrough。

退出证据：

- Next 15/16 fixture 均覆盖 Node、Edge、async params、query、JSON body；
- handler 保持 request-first；
- Factory 的配置快照和子作用域不可变。

## Phase 5 — 真实业务链路和适用性证明

Status: completed

已完成：

- 完整 authenticated resource flow 测试；
- Request ID Middleware；
- authentication Guard；
- Guard 早于 malformed Body 解析；
- dynamic params、query、JSON body；
- per-argument Pipe；
- response Interceptor；
- ExceptionFilter；
- success、unauthorized、validation-error 三条路径；
- 代表性 CRUD/Auth Route 的改造前后示例。

公开 API 的验收标准：

- 选 10 个普通 JSON CRUD/Auth Route；
- 非业务代码行数中位数至少下降 20%；
- 不新增 Controller、Module、Decorator、DI 等强制概念；
- 业务开发者能直接看懂 Route 和 Service；
- 流、上传、Webhook、Cron、长任务不被强行改造。

## Phase 6 — 双语用户文档和维护文档

Status: completed

已完成：

- 根目录 README.md 和 README.zh-CN.md；
- docs/en 和 docs/zh-CN 独立用户文档树；
- RESTful 详情、列表、创建、更新、删除示例；
- 配置、输入、错误、插件、测试、兼容性和迁移文档；
- 技术方案和架构决策；
- API 命名和生命周期 ADR 同步；
- docs:check 的本地链接和双语页面校验。

退出证据：

- docs:check 通过，验证 55 个 Markdown 文件和 11 个双语用户页面；
- Prettier 通过，英文和简体中文代码块均已统一格式；
- 根 README 聚焦安装、真实价值、RESTful 示例、参数和适用边界；
- 历史 ADR、发布说明、包 README 和双语用户指南均使用当前公共契约。

## Phase 7 — 发布门禁

Status: completed; release workflow hardening in progress

必须按顺序执行：

1. docs:check；
2. prettier --check；
3. lint；
4. typecheck；
5. test；
6. build；
7. verify:packed；
8. verify:next:prod；
9. verify:next:dev；
10. git diff --check；
11. npm pack 内容和安装边界复核；
12. 记录远程 CI、npm scope 和 Release workflow 状态。

退出证据（2026-08-19）：

- 完整 `pnpm release:check` 通过；
- 全部 package tests 通过；
- 4 个公开包的实际 tarball 和 external consumer 通过；
- Next.js 15.5.23、16.3.1 production 和 Turbopack development smoke 通过；
- git diff --check、ESLint、typecheck、build、Prettier 全部通过；
- Next.js 15/16 的可操作 warning 已修复；Next 15 真实 Edge App Route 的静态生成限制仍按
  Next 自身行为记录在兼容性矩阵。
- GitHub CI 已通过；
- 四个 `0.1.0` 包已发布到 npm；
- 四个 package-version tag 已存在于 GitHub；
- 发布环境和 `NPM_TOKEN` 已配置并完成一次受保护发布。

当前维护收尾：CI 和 Release workflow 已升级到 Node.js 24-compatible Actions，
并将 tag 同步改为幂等校验脚本；待本次修改推送后由远程 CI 验证。

## Checkpoint 模板

每次完成阶段后，更新 docs/status/project-status.md：

```md
### YYYY-MM-DD — Phase N checkpoint

- Status:
- Changed:
- Verified:
- Decisions:
- Risks:
- Next:
```
