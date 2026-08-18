# 输入源与校验

[English](../../en/user-guide/input-and-validation.md) · **简体中文**

输入解析和输入校验是分开的。主包负责从 Web Request 获取数据；Input Pipe 或可选适配包负责判断数据是否符合业务规则。

## 内置输入源

```ts
import { body, headers, jsonBody, params, query, textBody } from 'next-route-kit'
```

| 输入源          | 值                                                      | 说明                                |
| --------------- | ------------------------------------------------------- | ----------------------------------- |
| `jsonBody<T>()` | `Promise<T>`                                            | 延迟解析 JSON；`body<T>()` 是别名。 |
| `textBody()`    | `Promise<string>`                                       | 以文本读取 Body。                   |
| `query()`       | `Readonly<Record<string, string \| readonly string[]>>` | 重复 Query Key 会变成只读数组。     |
| `params<T>()`   | `T`                                                     | 读取已解析的动态路由参数。          |
| `headers()`     | `Headers`                                               | 返回 Request Headers 的副本。       |

## 组合输入对象

```ts
const GET = route({
    input: {
        body: jsonBody<{ search: string }>(),
        query: query(),
        params: params<{ id: string }>(),
        headers: headers(),
        version: 'v1',
    },
    handler: ({ input }) => ({
        id: input.params.id,
        search: input.body.search,
        page: input.query.page,
        version: input.version,
    }),
})
```

Source Map 可以混合 Input Source 和字面量。Route Handler 编译时会对该对象做浅快照，之后再修改声明对象不会悄悄改变已经导出的 Handler。

## 自定义输入源

多个路由需要复用同一来源时，使用 `defineInputSource`：

```ts
import { defineInputSource } from 'next-route-kit'

const tenantId = defineInputSource('tenant-id', 'headers', ({ request }) => {
    const value = request.headers.get('x-tenant-id')

    if (!value) {
        throw new Error('Missing x-tenant-id')
    }

    return value
})

const route = createRoute()

export const GET = route({
    input: { tenantId },
    handler: ({ input }) => ({ tenantId: input.tenantId }),
})
```

Resolver 接收：

```ts
type RouteInputContext = {
    request: Request
    params: RouteParams
    state: TState
    readBody<T>(): Promise<T>
    readText(): Promise<string>
}
```

`readBody()` 和 `readText()` 共享 Request 的一次性 Body 流。重复调用会复用缓存的文本或 JSON 结果。Guard 可以在调用这两个方法之前拒绝请求。

## Resolver 函数

一次性逻辑可以直接使用 resolver，不必定义命名输入源：

```ts
const route = createRoute()

export const GET = route({
    input: async ({ request, params, state }) => ({
        url: request.url,
        id: params.id,
        userId: state.userId,
    }),
    handler: ({ input }) => input,
})
```

## Zod 适配器

安装可选适配器：

```bash
pnpm add @next-route-kit/zod zod
```

`zodPipe(schema)` 在输入解析后执行，并用 Zod 的解析结果替换当前输入，因此支持 transform 和异步 refinement。

```ts
import { z } from 'zod'
import { createRoute, jsonBody, query } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'

const bodySchema = z.object({ name: z.string().min(1) })
const querySchema = z.object({ page: z.coerce.number().int().positive().default(1) })

const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema, query: querySchema }))],
    errorMappers: [zodErrorMapper()],
})

export const POST = route({
    input: {
        body: jsonBody<z.input<typeof bodySchema>>(),
        query: query(),
    },
    handler: ({ input }) => ({
        name: input.body.name,
        page: input.query.page,
    }),
})
```

默认 Mapper 返回 `400`、`VALIDATION_ERROR` 和 `issues` 数组。可以通过 `{ status, code, message, headers, name }` 自定义。

校验失败会进入正常的 Error Mapper 链路。根据需要将 Mapper 注册到 Global Factory、Scope 或单个路由。
