# 从现有 Route Handler 迁移

[English](../../en/user-guide/migration.md) · **简体中文**

迁移可以渐进进行，现有原生 Handler 不需要一次性修改。

## 迁移前

```ts
export async function POST(request: Request) {
    const body = await request.json()
    return Response.json({ name: body.name })
}
```

## 迁移后

```ts
import { jsonBody } from 'next-route-kit'
import { route } from '@/src/server/routes'

export const POST = route({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ name: body.name }),
})
```

## 只迁移重复策略

1. Request ID、日志放到 Middleware。
2. 鉴权和权限放到 Guard 与 `extend()` 作用域。
3. 校验放到 Pipe 或可选的 Zod 适配包。
4. 统一响应和耗时放到 Interceptor。
5. 业务异常转换放到 Exception Filter。
6. 特殊 Request/Response 流程继续原生实现。

如果新作用域没有让业务逻辑更易读，就不要迁移这个 Route。
