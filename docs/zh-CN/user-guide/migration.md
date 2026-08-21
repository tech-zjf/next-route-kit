# 从现有 Route Handler 迁移

[English](../../en/user-guide/migration.md) · **简体中文**

迁移可以渐进进行，现有原生 Handler 不需要一次性修改。

## 迁移前

```ts
export async function POST(request: Request) {
    try {
        const user = await authenticate(request)
        const body = CreateSchema.parse(await request.json())
        const resource = await resourceService.create(user.id, body)

        return Response.json({ data: resource })
    } catch (error) {
        return mapApplicationError(error)
    }
}
```

## 迁移后

```ts
import { createRoute, jsonBody } from 'next-route-kit'

const apiRoute = createRoute({
    guards: [authenticationGuard],
    pipes: [validateCreateResource],
    exceptionFilters: [applicationErrorFilter],
})

export const POST = apiRoute({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body, locals }) => resourceService.create(locals.userId, body),
})
```

示例中的 `authenticate`、`authenticationGuard`、`validateCreateResource` 和
`applicationErrorFilter` 都由业务项目自己实现。这个包不会替你决定鉴权方式、
Schema 库、响应码或 Service 层。

## 只迁移重复策略

1. Request ID、日志放到 Middleware。
2. 鉴权和权限放到 Guard 与 `extend()` 作用域。
3. 校验放到 Pipe 或可选的 Zod 适配包。
4. 统一响应和耗时放到 Interceptor。
5. 业务异常转换放到 Exception Filter。
6. 特殊 Request/Response 流程继续原生实现。

如果新作用域没有让业务逻辑更易读，就不要迁移这个 Route。
