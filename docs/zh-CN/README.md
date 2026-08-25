# next-route-kit 用户指南

[English](../en/README.md) · **简体中文**

这是面向包使用者的文档。仓库根目录 README 是快速概览；架构和发布材料位于
`docs/architecture`、`docs/release`。

## 安装

```bash
npm install next-route-kit
npm install @next-route-kit/zod zod       # 可选
npm install -D @next-route-kit/testing    # 可选
```

## 从这里开始

- [为什么使用它](user-guide/why-route-kit.md)
- [快速开始](user-guide/getting-started.md)
- [配置与作用域](user-guide/configuration.md)
- [统一 API 响应契约](user-guide/api-response.md)
- [API Reference](user-guide/api-reference.md)
- [输入与校验](user-guide/input-and-validation.md)
- [链路、错误与响应](user-guide/pipeline-and-errors.md)
- [插件](user-guide/plugins.md)
- [测试](user-guide/testing.md)
- [迁移](user-guide/migration.md)
- [问题排查](user-guide/troubleshooting.md)

## 生产项目接入与兼容性反馈

本包面向真实的 App Router 项目，解决鉴权、校验、错误映射和响应封装等横切策略的
重复问题。建议从一条有代表性的 Route Handler 开始渐进迁移，再根据实际接口形态
扩展共享 Factory。

报告迁移或兼容性结果时，请提供 Next.js 版本、runtime、迁移的接口形态，以及涉及的
API 或文档位置。请通过[兼容性与迁移 Issue](https://github.com/tech-zjf/next-route-kit/issues/new/choose)
提交；这些信息会直接用于维护兼容性矩阵和改进公开 API。

## 基本模型

```ts
import { createRoute } from 'next-route-kit'

const route = createRoute()

export const GET = route({
    handler: (request, { params, locals }) => ({
        method: request.method,
        params,
        locals,
    }),
})
```

导出的值就是可供 Next 使用的普通 Route Handler。Factory 通过显式 import
连接，不扫描文件，也不需要在 `next.config.ts` 注册。
