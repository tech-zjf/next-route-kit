# 快速开始

[English](../../en/user-guide/getting-started.md) · **简体中文**

## 安装

```bash
npm install next-route-kit
```

目标是 Next.js App Router Route Handler，包自身的 Node.js 基线为 `>=18.18.0`。

## 创建基础 Factory

```ts
// src/server/routes.ts
import { createRoute, jsonResponse } from 'next-route-kit'

export const route = createRoute({
    response: jsonResponse(),
})
```

在各个 Route Handler 中 import 应用自己持有的 Factory。不需要在
`next.config.ts` 注册。

## 编写详情接口

```ts
// app/api/resources/[id]/route.ts
import { route } from '@/src/server/routes'

type ResourceParams = { id: string }

export const GET = route<ResourceParams>({
    handler: async (request, { params }) => {
        const resource = await resourceService.find(params.id)
        return resource ?? new Response(null, { status: 404 })
    },
})
```

Handler 第一个参数是原生 `Request`。Next 的动态 params 会在 Middleware 之前
解析，并出现在 `context.params`。

## 创建鉴权作用域

```ts
import { unauthorized } from 'next-route-kit'

const authenticatedRoute = route.withLocals({
    name: 'authentication',
    provide(context) {
        if (context.request.headers.get('authorization') !== 'Bearer sample-token') {
            throw unauthorized()
        }

        return { userId: 'viewer-demo' }
    },
})
```

Provider 的真实返回值会自动进入后续 Handler 的 locals 类型，不需要额外声明
`userId?` 或使用类型断言。普通 Guard 仍适合不产生新 locals 的权限检查。

## 只在需要时声明 Body/Query

```ts
import { jsonBody, query } from 'next-route-kit'

type CreateResource = { title: string }
type CreateQuery = { publish?: string }

export const POST = authenticatedRoute({
    body: jsonBody<CreateResource>(),
    query: query<CreateQuery>(),
    handler: async (_request, { body, query: values, locals }) =>
        resourceService.create({
            userId: locals.userId,
            title: body.title,
            publish: values.publish === 'true',
        }),
})
```

列表接口可以直接使用 `new URL(request.url)`。Params 已在 context 上，Header
在 `request.headers` 上，不需要为了读取一个值再写空的 helper 声明。

## 返回值

普通值由默认 JSON serializer 处理。流、文件、跳转、特殊状态码或 `204` 请直接
返回原生 `Response`。

继续阅读 [API Reference](api-reference.md)。
