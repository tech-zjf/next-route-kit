# 为什么使用 next-route-kit？

[English](../../en/user-guide/why-route-kit.md) · **简体中文**

当很多 Route Handler 都重复同一套策略代码时，这个包才有价值。一次性接口如果
原生代码更清楚，不需要为了抽象而使用它。

## 真实的重复问题

一个典型的鉴权 JSON 接口往往要同时处理 Request ID、鉴权、Body、校验、响应封装
和 try/catch：

```ts
export async function POST(request: Request, context: NextContext) {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const auth = await getCurrentAuth(request)

    if (!auth) {
        return Response.json({ code: 'UNAUTHORIZED', requestId }, { status: 401 })
    }

    try {
        const body = await request.json()
        if (!isValidResource(body)) {
            return Response.json({ code: 'INVALID_INPUT', requestId }, { status: 422 })
        }

        const params = await context.params
        const result = await resourceService.create({
            tenantId: params.tenantId,
            userId: auth.userId,
            body,
        })

        return Response.json({ data: result, requestId })
    } catch (error) {
        return toApiError(error, requestId)
    }
}
```

单个接口这样写没有问题，但在几十个接口中复制后，策略和响应契约很容易漂移。

## 使用共享作用域

```ts
const apiRoute = createRoute<ApiLocals>({
    middleware: [requestIdMiddleware],
    interceptors: [responseEnvelope],
    exceptionFilters: [apiExceptionFilter],
})

const authenticatedRoute = apiRoute.extend({
    guards: [authenticationGuard],
})

export const POST = authenticatedRoute<ResourceParams, ResourceBody>({
    body: jsonBody<ResourceBody>(),
    handler: async (_request, { params, body, locals }) =>
        resourceService.create({
            tenantId: params.tenantId,
            userId: locals.userId,
            body,
        }),
})
```

Route 文件只展示当前接口的输入和业务调用，共享策略仍然可以从 import 的
Factory 看见。

## 它改善什么

- Request 级初始化、鉴权、统一响应、异常响应只有一份实现；
- 固定顺序保证鉴权早于 Body 解析；
- public/authenticated/admin 作用域清楚且不可变；
- Handler 仍然接收原生 Request，也能直接返回原生 Response；
- 测试执行的就是部署时导出的 Handler。

## 它不应该接管什么

流式响应、Multipart、签名 Webhook、Cron Secret 和复杂多阶段任务，如果原生
Next Handler 更清楚，就继续原生实现。包应该消除重复策略，而不是为每个接口
制造新抽象。
