# 快速开始

[English](../../en/user-guide/getting-started.md) · **简体中文**

本指南使用 Next.js 原生 App Router 目录结构。不需要修改 `route.ts` 文件约定，也不需要在 `next.config.ts` 中注册任何内容。

如果想先了解这套链路具体解决了什么问题，请阅读[为什么使用 next-route-kit？](./why-route-kit.md)。

## 1. 安装

```bash
pnpm add next-route-kit
```

应用需要已经使用 Next.js App Router 和 Route Handler。Node.js 版本遵循应用所使用 Next.js 版本的要求。

发布包是 ESM 包，请使用 `import`/`export`。包自身的基线是 Node.js
`>=18.18.0`；如果使用更高版本的 Next.js，Next.js 可能额外要求更高版本的 Node.js。

## 2. 创建共享 Factory

把 Factory 放到应用自己的服务端模块中。文件名和目录可以按团队习惯决定，`next-route-kit` 不会扫描它们。

```ts
// src/server/routes/index.ts
import { createRoute, jsonResponse } from 'next-route-kit'

export const route = createRoute({
    response: jsonResponse(),
})
```

Factory 是不可变且可调用的。调用 `route(options)` 会编译一个 Route Handler；调用 `route.extend(config)` 会为某个业务作用域创建新的不可变 Factory。

## 3. 导出普通 Route Handler

```ts
// app/api/users/route.ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

type CreateUserInput = {
    name: string
}

export const POST = route({
    input: jsonBody<CreateUserInput>(),
    handler: async ({ input }) => ({
        name: input.name,
    }),
})
```

Handler 返回对象时，默认 JSON Serializer 会生成 JSON 响应。需要完全控制响应时，可以直接返回原生 `Response`：

```ts
export const DELETE = route({
    handler: () => new Response(null, { status: 204 }),
})
```

## 4. 读取 query、params 和 headers

可以把多个输入源组合成一个类型安全的 `input` 对象：

```ts
// app/api/users/[id]/route.ts
import { headers, params, query } from 'next-route-kit'
import { route } from '@/src/server/routes'

type UserParams = { id: string }

export const GET = route({
    input: {
        params: params<UserParams>(),
        query: query(),
        headers: headers(),
    },
    handler: ({ input }) => ({
        id: input.params.id,
        preview: input.query.preview,
        authorization: input.headers.get('authorization'),
    }),
})
```

动态路由参数会在 Middleware 和 Guard 执行前由适配层完成 hydrate。在 Handler 和输入源中，`params` 已经是解析后的对象；Next.js Route Handler 内部的第二个参数仍然遵循 Promise 形式。

## 5. 添加业务作用域

将共享策略放到 Scope Factory，避免每个路由重复声明：

```ts
// src/server/routes/scopes.ts
import { route } from './index'
import { requireUser } from '../security/require-user'

export const authenticatedRoute = route.extend({
    guards: [requireUser],
})
```

```ts
// app/api/account/route.ts
import { authenticatedRoute } from '@/src/server/routes/scopes'

export const GET = authenticatedRoute({
    handler: ({ state }) => ({ userId: state.userId }),
})
```

配置合并顺序以及继承组件的安全策略见[配置与作用域](./configuration.md)。

## 6. 按需添加校验

Core 和主包不强制绑定校验库：

```bash
pnpm add @next-route-kit/zod zod
```

```ts
import { z } from 'zod'
import { createRoute, jsonBody } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'

const bodySchema = z.object({ name: z.string().min(1) })

const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema }))],
    errorMappers: [zodErrorMapper()],
})

export const POST = route({
    input: { body: jsonBody<z.input<typeof bodySchema>>() },
    handler: ({ input }) => ({ name: input.body.name }),
})
```

## 请求生命周期

公开链路顺序固定为：

```text
Next params hydration
  → Middleware
  → Guard
  → Input Resolver
  → Input Pipe
  → Interceptor
  → Handler
  → Response Serializer
```

Guard 可以在路由 Body 被读取前拒绝请求。Input Pipe 会在 Handler 前转换已解析的输入。Error Mapper 可以处理整条链路中的异常。
