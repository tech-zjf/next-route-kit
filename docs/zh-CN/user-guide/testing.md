# 测试 Route Handler

[English](../../en/user-guide/testing.md) · **简体中文**

安装与测试框架无关的测试包：

```bash
pnpm add -D @next-route-kit/testing
```

它使用原生 `Request` 和 `Response`，不强制使用 Vitest、Jest、Node test runner 或其他断言框架。

如果只测试裸 `createRoute()`，无法证明共享链路解决了什么问题。请先看[为什么使用 next-route-kit？](./why-route-kit.md)，其中的真实链路测试使用认证订单流程，覆盖成功、未授权和非法输入三条用户路径。

## 直接调用 Route Handler

```ts
import { createRoute, jsonBody } from 'next-route-kit'
import { expectResponse, invokeRoute, RequestBuilder } from '@next-route-kit/testing'

const route = createRoute()
const POST = route({
    input: jsonBody<{ name: string }>(),
    handler: ({ input }) => ({ greeting: `Hello ${input.name}` }),
})

const response = await invokeRoute(POST, RequestBuilder.post('/api/greeting').json({ name: 'Ada' }))

await expectResponse(response).toHaveStatus(200).toHaveJson({ greeting: 'Hello Ada' })
```

## 测试真实业务路由

Factory 配置应放在应用代码中，测试则直接调用使用它的 Route Handler。下面一条请求同时验证动态 params、认证、JSON 输入、校验和统一响应契约：

```ts
const response = await invokeRoute(
    POST,
    RequestBuilder.post('/api/accounts/acct-7/orders')
        .params({ accountId: 'acct-7' })
        .query({ preview: 'true' })
        .header('authorization', 'Bearer demo-token')
        .header('x-request-id', 'req-7')
        .json({ sku: 'sku-42', quantity: 2 }),
)

const payload = await expectResponse(response)
    .toBeOk()
    .toHaveHeader('x-route-kit', 'real-chain')
    .json<{ data: { orderId: string }; meta: { requestId: string } }>()

expect(payload.data.orderId).toBe('order-user-42-sku-42')
expect(payload.meta.requestId).toBe('req-7')
```

再分别覆盖缺少凭证和非法输入。重要的不只是最终 JSON：未认证请求应该在解析非法 Body 之前返回 `401`；认证后的非法订单应该返回约定的校验错误，并且不调用 Handler。

`invokeRoute` 接受原生 `Request`、`RequestBuilder`，或包含 Request 与 Promise params context 的 `RouteTestRequest`。

## `RequestBuilder`

Builder 是不可变的，每个方法都会返回新的 Builder。

| 方法                         | 作用                                        |
| ---------------------------- | ------------------------------------------- |
| `RequestBuilder.get(url?)`   | 创建 GET 请求。                             |
| `RequestBuilder.post(url?)`  | 创建 POST 请求。                            |
| `.method(method)`            | 设置 HTTP Method。                          |
| `.query(name, value)`        | 设置一个 Query Key。                        |
| `.query({ key: value })`     | 设置多个 Query Key；数组会生成重复 Key。    |
| `.header(name, value)`       | 设置一个 Header。                           |
| `.headers(values)`           | 合并 Headers。                              |
| `.json(value)`               | 序列化 JSON，并默认设置 JSON Content-Type。 |
| `.text(value, contentType?)` | 设置文本 Body 和 Content-Type。             |
| `.body(value, contentType?)` | 设置原始 `BodyInit`。                       |
| `.params(params)`            | 提供动态 Route Handler params。             |
| `.build()`                   | 构建原生 `Request`。                        |
| `.buildContext()`            | 构建 Promise params context。               |
| `.buildRouteRequest()`       | 同时构建 Request 与 context。               |

动态路由和重复 Query Key 示例：

```ts
const request = RequestBuilder.get<{ id: string }>('/api/users')
    .query({ tag: ['one', 'two'], page: 2 })
    .header('authorization', 'Bearer test-token')
    .params({ id: '42' })

const response = await invokeRoute(GET, request)
```

## `expectResponse`

```ts
const assertion = expectResponse(response)

assertion.toBeOk()
assertion.toHaveStatus(200)
assertion.toHaveHeader('content-type', 'application/json')
await assertion.toHaveJson({ ok: true })
await assertion.toHaveText('plain text')
```

Response Body 读取会缓存，因此同一个 assertion 对象可以检查文本和 JSON，而不会重复消费响应流。

## 测试插件

使用 `createTestPlugin` 验证插件安装和 Factory 组合：

```ts
import { createTestPlugin } from '@next-route-kit/testing'

const plugin = createTestPlugin('trace', {
    middleware: [traceMiddleware],
})

const route = createRoute({ plugins: [plugin] })
expect(plugin.installCount).toBe(1)
```

这个包是辅助库，不是 Next.js Server 模拟器。路由、缓存、打包和 Node/Edge 行为应由项目的 Next.js 兼容性 fixture 或应用集成测试验证。
