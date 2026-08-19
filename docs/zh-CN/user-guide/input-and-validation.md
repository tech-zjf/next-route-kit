# 输入与校验

[English](../../en/user-guide/input-and-validation.md) · **简体中文**

解析是可选的。只有类型化、可复用的值能让 Route 更清晰时，才声明解析器。

## Body

```ts
export const POST = route({
    body: jsonBody<CreateInput>(),
    handler: async (_request, { body }) => service.create(body),
})
```

文本请求使用 `textBody()`。如果原生读取更清楚，就省略 `body`，在 Handler
中直接调用 `request.text()` 或 `request.json()`。Body 延迟解析并缓存，
Guard 会先执行。声明 `body` 后，Handler 应使用命名的 `body` 值，因为底层
Request 流可能已经被解析器消费。

## Query

```ts
type ListQuery = { search?: string; page?: string }

export const GET = route({
    query: query<ListQuery>(),
    handler: (_request, { query: values }) => service.list(values),
})
```

重复 Key 会变成只读数组。一次性 Query 可以直接使用
`new URL(request.url).searchParams`。

## Params 和 Headers

```ts
export const GET = route<{ id: string }>({
    handler: (request, { params }) => ({
        id: params.id,
        authorization: request.headers.get('authorization'),
    }),
})
```

普通 Route 不需要声明 Params/Headers helper，直接从上面的 named context 和原生
request 上读取即可。

## 自定义 Source

```ts
const tenantBody = defineInputSource('tenant-body', 'body', ({ readBody }) => {
    return readBody<{ tenantId: string }>()
})

export const POST = route({
    body: tenantBody,
    handler: (_request, { body }) => ({ tenantId: body.tenantId }),
})
```

当这个解析器在多个接口中重复使用，并且放到 `body` 或 `query` 后能让
Handler 更易读时，再使用它。一次性的 Header 直接从 `request.headers`
读取即可。

## Pipe

Pipe 按声明的参数分别接收值：

```ts
const validateBody: Pipe = {
    name: 'validate-body',
    transform(value, metadata) {
        if (metadata.type !== 'body') return value
        return validate(value)
    },
}

const route = createRoute({ pipes: [validateBody] })
```

Core 不绑定校验库。可选的 `@next-route-kit/zod` 包提供 `zodPipe()`；不使用统一
响应外壳的 Route 还可以选择 `zodExceptionFilter()`。如果 Route 使用
`apiResponsePlugin()`，应通过它的可选 `mapError` 映射 `ZodValidationError`，这样
校验异常仍保持 `{ code, msg, data }` 契约。一个作用域同时校验 Body、Query 时使用
`appliesTo` 区分目标。
