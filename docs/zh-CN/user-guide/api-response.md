# 稳定的统一 API 响应

[English](../../en/user-guide/api-response.md) · **简体中文**

很多生产 API 都需要一份稳定的响应契约，让客户端可以先在请求层做通用处理，
再根据具体业务码做业务处理。`next-route-kit` 通过可选插件提供这套能力；流式
响应、上传、Webhook 等需要原生 `Response` 的接口不会被强制套上 JSON 外壳。

## 在业务项目中维护错误码

响应码不由包接管，而是由业务项目自己维护，建议放在独立的响应码模块中：

```ts
export const ResponseCode = {
    SUCCESS: { code: 'OK', msg: '成功' },
    QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', msg: '配额不足', status: 409 },
    RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', msg: '资源不存在', status: 404 },
    INVALID_INPUT: { code: 'INVALID_INPUT', msg: '输入无效', status: 422 },
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', msg: '系统错误' },
} as const
```

`code` 是稳定的业务契约。配置了 `status` 时，它只表示该异常对应的 HTTP 传输
状态，不会替代响应中的业务 `code`。

## 只注册一次统一响应插件

把插件注册在基础 Factory 上，所有派生作用域和 Route 都会继承相同的成功与异常
响应结构：

```ts
import { ApiException, apiResponsePlugin, createRoute, jsonBody } from 'next-route-kit'
import { ResponseCode } from '@/server/response-code'

const apiContract = apiResponsePlugin({
    success: ResponseCode.SUCCESS,
    systemError: ResponseCode.INTERNAL_ERROR,
    onUnknownError(error) {
        console.error('[api] unexpected error', error)
    },
})

export const apiRoute = createRoute({
    plugins: [apiContract],
})

export const authenticatedRoute = apiRoute.extend({
    guards: [requireUser],
})

type CreateResourceInput = {
    label: string
    size: number
}

export const POST = authenticatedRoute({
    body: jsonBody<CreateResourceInput>(),
    handler: async (_request, { body, locals }) => {
        const availableQuota = await quotaService.getAvailable(locals.userId)

        if (availableQuota < body.size) {
            throw new ApiException(ResponseCode.QUOTA_EXCEEDED, {
                data: { requested: body.size, available: availableQuota },
            })
        }

        return {
            resourceId: await resourceService.create({
                userId: locals.userId,
                label: body.label,
                size: body.size,
            }),
        }
    },
})
```

Handler 只返回业务数据或抛出业务异常，不再创建 `NextResponse`，也不重复书写
`code`、`msg`，更不需要在每个 Route 里复制一套 `try/catch`。

## 实际返回结构

成功响应：

```json
{
    "code": "OK",
    "msg": "成功",
    "data": {
        "resourceId": "resource-demo"
    }
}
```

业务异常：

```json
{
    "code": "QUOTA_EXCEEDED",
    "msg": "配额不足",
    "data": {
        "requested": 10,
        "available": 3
    }
}
```

`data` 永远是对象。列表接口建议直接返回 `{ items, total, nextCursor }`；如果
项目希望所有列表都使用统一字段，也可以在插件中配置一次 `mapData`：

```ts
const apiContract = apiResponsePlugin({
    success: ResponseCode.SUCCESS,
    systemError: ResponseCode.INTERNAL_ERROR,
    mapData: (value) => ({ items: value }),
})
```

默认情况下，原始值会被放入 `{ value }`。这样既保证 `data` 的结构稳定，也不会
把列表字段的含义藏在每个 Route 的临时包装里。

## 全局错误与业务错误如何分工

服务端包不会替前端决定是弹全局 Toast 还是打开某个业务弹窗，它只提供稳定的业务
码作为分流依据：

```ts
if (payload.code === ResponseCode.QUOTA_EXCEEDED.code) {
    // 当前功能可以展示配额详情，或引导用户升级。
    showQuotaDialog(payload.data)
}
```

前端请求层可以统一处理登录失效、无权限、配额不足、系统异常等通用码；具体功能
页面再处理自己的业务码。不需要再猜服务端返回的是数字还是字符串，也不需要兼容
`message` 和 `msg` 两套字段。

未识别的异常会统一映射为 `systemError`，内部错误信息不会返回给客户端。可以用
`onUnknownError` 接入日志、链路追踪或 Sentry。

## 可选的校验适配器

统一响应插件不依赖、也不会自动安装任何校验库。如果项目选择可选的 Zod 适配包，
可以通过 `mapError` 把适配器异常映射到同一份响应契约：

```ts
import { apiResponsePlugin, createRoute } from 'next-route-kit'
import { ZodValidationError, zodPipe } from '@next-route-kit/zod'

const apiRoute = createRoute({
    pipes: [zodPipe(schema, { appliesTo: 'body' })],
    plugins: [
        apiResponsePlugin({
            success: ResponseCode.SUCCESS,
            systemError: ResponseCode.INTERNAL_ERROR,
            mapError: (error) => {
                if (!(error instanceof ZodValidationError)) {
                    return undefined
                }

                return {
                    code: ResponseCode.INVALID_INPUT,
                    data: { issues: error.issues },
                }
            },
        }),
    ],
})
```

`@next-route-kit/zod` 完全可选。`zodExceptionFilter()` 是给不使用统一 API 外壳的
Route 使用的另一种独立错误边界；不要和统一响应 Filter 同时注册，除非项目明确
接受两套不同的响应结构。

## 从现有 Next API 迁移

| 手写 Route 中重复的代码                                   | 统一契约后的写法                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `NextResponse.json({ ...API_RESPONSE.SUCCESS, data })`    | `return data`                                                          |
| `NextResponse.json({ ...API_RESPONSE.BAD_REQUEST, msg })` | `throw new ApiException(ResponseCode.INVALID_INPUT, { message: msg })` |
| 每个 Route 都写 `try/catch`                               | 在插件中配置一次 `systemError`                                         |
| 每个功能重复 `handleApiError(error)`                      | Service 抛 `ApiException`，特殊数据再配置 `mapErrorData`               |
| 前端同时按 HTTP 状态和混合类型 `code` 分支                | 前端只按稳定的业务 `code` 分支                                         |

流式响应、Multipart、签名 Webhook、重定向等协议仍然使用原生 Handler。目标是
提升重复 JSON CRUD/鉴权接口的阅读性和维护性，而不是给所有响应强行套壳。
