# 测试 Route Handler

[English](../../en/user-guide/testing.md) · **简体中文**

```bash
npm install -D @next-route-kit/testing
```

辅助包使用原生 `Request` 和 `Response`，不绑定 Vitest、Jest 或其他测试框架。

## 直接测试

```ts
const POST = createRoute()({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ greeting: 'Hello ' + body.name }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api').json({ name: 'Ada' }))

await expectResponse(response).toHaveStatus(200).toHaveJson({ greeting: 'Hello Ada' })
```

## 测试真实共享链路

测试应直接使用业务 Route import 的同一个 Factory：

```ts
const response = await invokeRoute(
    POST,
    RequestBuilder.post('/api/tenants/tenant-demo/resources')
        .params({ tenantId: 'tenant-demo' })
        .query({ preview: 'true' })
        .header('authorization', 'Bearer sample-token')
        .header('x-request-id', 'request-demo')
        .json({ label: 'sample', size: 2 }),
)

const payload = await expectResponse(response)
    .toBeOk()
    .toHaveHeader('x-route-kit', 'real-chain')
    .json<{ data: { resourceId: string }; meta: { requestId: string } }>()

expect(payload.meta.requestId).toBe('request-demo')
```

还要覆盖未鉴权的非法 Body，以及鉴权后校验失败的场景。仓库的 real-chain 测试
覆盖这三种结果，并验证 Guard 或 Pipe 中断后 Handler 不会执行。

`RequestBuilder` 不可变，支持 Query、Header、JSON/文本/原始 Body 和 Promise
params。`ResponseAssertions` 会缓存响应 Body 的读取。
