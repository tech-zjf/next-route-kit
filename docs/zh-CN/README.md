# next-route-kit 用户指南

[English](../en/README.md) · **简体中文**

`next-route-kit` 为 Next.js App Router 的原生 Route Handler 增加一套显式、类型安全的请求处理链路。它不会替换 `app/**/route.ts`、Next.js Router、`next.config.ts` 或 `proxy.ts`。

## 安装

```bash
pnpm add next-route-kit
```

可选包：

```bash
pnpm add @next-route-kit/zod zod
pnpm add -D @next-route-kit/testing
```

## 从这里开始

- [为什么使用 next-route-kit？](./user-guide/why-route-kit.md)
- [快速开始](./user-guide/getting-started.md)
- [配置与作用域](./user-guide/configuration.md)
- [API Reference](./user-guide/api-reference.md)
- [输入源与校验](./user-guide/input-and-validation.md)
- [链路、错误与响应](./user-guide/pipeline-and-errors.md)
- [编写插件](./user-guide/plugins.md)
- [从现有 Route Handler 迁移](./user-guide/migration.md)
- [测试](./user-guide/testing.md)
- [问题排查](./user-guide/troubleshooting.md)
- [0.1.0 发布说明](./release/v0.1.0.md)

## 基本模型

在应用中创建一个或多个由应用自己持有的 Factory，然后在每个 Route
Handler 中显式导入合适的 Factory：

```ts
// src/server/routes/index.ts
import { createRoute } from 'next-route-kit'

export const route = createRoute()
```

```ts
// app/api/health/route.ts
import { route } from '@/src/server/routes'

export const GET = route({
    handler: () => ({ ok: true }),
})
```

默认 Serializer 会把普通返回值转换成 JSON；如果 Handler 返回原生
`Response`，则会原样透传。

## 用户文档与维护者文档

本目录是面向应用使用者的文档。架构决策、实现进度、兼容性证据和发布流程位于仓库的[开发维护文档入口](../development/README.md)。

## 版本与兼容性

当前公开基线版本为 `0.1.0`，已针对 Next.js 15.5.23 和 16.3.1 的 Node、Edge
Route Handler 完成验证。具体边界见[兼容性矩阵](../compatibility/next-matrix.md)、[问题排查](./user-guide/troubleshooting.md)和[发布说明](./release/v0.1.0.md)。
