# 为什么使用 next-route-kit？

**简体中文** · [English](../../en/user-guide/why-route-kit.md)

当项目不再只有几个 Route Handler，并且每个 `route.ts` 都开始重复请求 ID、认证、输入解析、参数校验、统一响应和错误格式时，`next-route-kit` 才真正体现价值。

它保留 Next.js 原生文件约定和 Handler 导出方式，只把这些横切关注点集中到可复用的 Factory Scope 中。

## 不使用共享链路时的问题

假设订单服务有两个接口。不使用共享链路时，每个 Handler 往往都要重复同一套策略，而且这些策略的顺序很容易被不小心改错：

```ts
// app/api/accounts/[accountId]/orders/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const authorization = request.headers.get('authorization')

    if (authorization !== 'Bearer token') {
        return Response.json({ code: 'UNAUTHORIZED', requestId }, { status: 401 })
    }

    try {
        const body = await request.json()

        if (!isValidOrder(body)) {
            return Response.json({ code: 'INVALID_ORDER', requestId }, { status: 422 })
        }

        const routeParams = await params
        const result = await orderService.create({
            accountId: routeParams.accountId,
            ...body,
        })

        return Response.json({ data: result, requestId })
    } catch (error) {
        return Response.json({ code: toErrorCode(error), requestId }, { status: toStatus(error) })
    }
}
```

下一个接口通常会复制请求 ID、认证、校验、成功响应包装和 `try/catch`。时间一长，不同接口的状态码、错误结构、日志和安全检查就会逐渐不一致，也很难保证认证一定发生在一次性 Body 被消费之前。

## 使用 Factory 后的同一条链路

先创建一个应用级 Base Factory，放置所有 API 都需要的策略；再为需要认证的接口派生 Scope，最后为订单输入派生校验 Scope：

```ts
// src/server/routes.ts
import { createRoute, HttpError, jsonResponse, unauthorized, type AnyRouteContext } from 'next-route-kit'

type ApiState = {
    requestId: string
    startedAt: number
    userId?: string
}

type ApiContext = AnyRouteContext<ApiState>

const apiRoute = createRoute<ApiState>({
    middleware: [
        {
            name: 'request-id',
            handle(context, next) {
                context.state.requestId = context.request.headers.get('x-request-id') ?? crypto.randomUUID()
                context.state.startedAt = Date.now()
                return next()
            },
        },
    ],
    interceptors: [
        {
            name: 'response-envelope',
            async intercept(context, next) {
                const value = await next()

                return {
                    data: value,
                    meta: {
                        requestId: context.state.requestId,
                        durationMs: Date.now() - context.state.startedAt,
                    },
                }
            },
        },
    ],
    errorMappers: [
        {
            name: 'api-error',
            map(error, context) {
                if (!(error instanceof HttpError)) {
                    return undefined
                }

                return Response.json(
                    {
                        code: error.code,
                        message: error.message,
                        requestId: context.state.requestId,
                    },
                    { status: error.status },
                )
            },
        },
    ],
    response: jsonResponse(),
})

const authenticatedRoute = apiRoute.extend({
    guards: [
        {
            name: 'authentication',
            canActivate(context) {
                if (context.request.headers.get('authorization') !== 'Bearer token') {
                    throw unauthorized()
                }

                context.state.userId = 'user-42'
                return true
            },
        },
    ],
})

export const ordersRoute = authenticatedRoute.extend({
    inputPipes: [validateOrderInput],
})

function validateOrderInput(value: unknown) {
    const input = value as { body?: { sku?: unknown; quantity?: unknown } }

    if (typeof input.body?.sku !== 'string' || typeof input.body.quantity !== 'number' || input.body.quantity <= 0) {
        throw new HttpError({
            status: 422,
            code: 'INVALID_ORDER',
            message: 'sku and quantity must be valid',
        })
    }

    return value
}
```

Route Handler 仍然是普通的 Next.js 文件，只声明输入和业务操作：

```ts
// app/api/accounts/[accountId]/orders/route.ts
import { jsonBody, params, query } from 'next-route-kit'
import { ordersRoute } from '@/src/server/routes'

export const POST = ordersRoute({
    input: {
        account: params<{ accountId: string }>(),
        body: jsonBody<{ sku: string; quantity: number }>(),
        query: query(),
    },
    handler: async ({ input, state }) =>
        orderService.create({
            accountId: input.account.accountId,
            userId: state.userId,
            sku: input.body.sku,
            quantity: input.body.quantity,
            preview: input.query.preview === 'true',
        }),
})
```

请求现在有一条清晰、固定的链路：

```text
Next params hydration
  → Middleware：请求 ID 和请求级 state
  → Guard：认证与授权
  → Input Resolver：body、query、headers、params
  → Input Pipe：校验与转换
  → Interceptor：成功响应包装、耗时、缓存或 tracing
  → Handler：只处理业务逻辑
  → Response Serializer：原生 JSON Response
```

异常不会继续执行成功响应 Interceptor 的回收阶段，而是交给 Error Mapper。这让两者职责明确：Interceptor 负责成功链路，Error Mapper 负责错误契约。

## 对团队实际解决的问题

| 重复问题                           | Factory 方案                                                   |
| ---------------------------------- | -------------------------------------------------------------- |
| 每个路由都创建请求 ID、日志代码    | 在 Base Factory 注册一次 Middleware。                          |
| 每个受保护路由都重复认证           | 通过 `extend({ guards })` 派生 `authenticatedRoute`。          |
| 每个 Handler 都手动解析和校验 Body | 组合 `jsonBody()`，添加 Input Pipe，或使用可选的 Zod Adapter。 |
| 不同接口的响应格式逐渐漂移         | 使用统一 Interceptor 和 Response Serializer 策略。             |
| 错误结构和状态码不一致             | 统一注册 Error Mapper，让路由只关注业务错误。                  |
| 安全检查不小心先读取 Body          | Guard 在 Input Resolver 和一次性 Body 读取之前运行。           |
| Route 文件被迫改造成框架类         | 保留原生 `app/**/route.ts` 导出，只使用轻量可调用 Factory。    |

## 验证用户链路，而不是只验证默认 Factory

仓库包含真实订单流程测试，验证：

- 登录请求可以携带动态 params、query 和 JSON body 到达 Handler；
- 统一成功响应中包含 request ID 和 user ID；
- 未登录请求会在解析非法 JSON 之前被拒绝；
- 非法订单输入会得到稳定的 `422` 错误和 request ID；
- 实际阶段顺序是 Middleware → Guard → Input Resolver → Input Pipe → Interceptor → Handler。

同一条链路还会通过真实的 Next.js 15 和 16 Route Handler 在兼容性 fixture 中执行。详见[测试](./testing.md)和 [Next.js 兼容性矩阵](../../compatibility/next-matrix.md)。
