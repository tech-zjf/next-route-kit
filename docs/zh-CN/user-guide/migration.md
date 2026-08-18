# 从现有 Route Handler 迁移

[English](../../en/user-guide/migration.md) · **简体中文**

迁移可以渐进进行。已有的 `app/**/route.ts` 仍然有效；只有需要共享链路能力的路由才需要使用 Factory。

## 迁移前

```ts
export async function POST(request: Request) {
    const body = (await request.json()) as { name: string }
    return Response.json({ name: body.name })
}
```

## 迁移后

```ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

export const POST = route({
    input: jsonBody<{ name: string }>(),
    handler: ({ input }) => ({ name: input.name }),
})
```

## 按小步骤迁移横切逻辑

1. 创建一个由应用持有的 Factory。
2. 将统一响应和错误映射移入 Factory 配置。
3. 将认证放入 Guard 或 authenticated Scope Factory。
4. 将 Body、Query、Params 和 Headers 提取移入 `input` 输入源。
5. 通过 Input Pipe 或可选适配包添加校验。
6. 流、下载和特殊状态码继续直接返回原生 `Response`。

包不会自动包装或扫描已有路由。这个显式边界可以避免 Next.js 编译器升级时悄悄改变哪些路由受到保护。
