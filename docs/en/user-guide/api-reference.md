# API reference

**English** · [简体中文](../../zh-CN/user-guide/api-reference.md)

## Factory

```ts
const route = createRoute<TLocals>(config?)
const child = route.extend(config)
const handler = route<TParams, TBody, TQuery, TResult>(options)
```

`createRoute` returns a class-backed callable `Factory`. The result is a
Next-compatible Handler for method exports.

`TParams` can be a normal `type` alias or an `interface`. The default
`RouteParams` shape is used when no route parameter type is provided.

## Route options

```ts
type RouteOptions = {
    runtime?: 'nodejs' | 'edge'
    middleware?: RouteMiddleware[]
    guards?: Guard[]
    pipes?: Pipe[]
    interceptors?: Interceptor[]
    exceptionFilters?: ExceptionFilter[]
    plugins?: RoutePlugin[]
    use?: RoutePlugin[]
    response?: ResponseSerializer
    responseSerializer?: ResponseSerializer
    body?: RouteInputDefinition<TBody>
    query?: RouteInputDefinition<TQuery>
    handler: (request: Request, context: RouteHandlerContext) => unknown
}
```

Most routes need only `handler`. Add `body` or `query` only when the
package should resolve and cache that value.

When a route has no dynamic params, the types from `jsonBody<T>()` and
`query<T>()` are inferred without route generics. When a route has both typed
dynamic params and typed body/query values, provide the generic types in the
order `route<TParams, TBody, TQuery, TResult>`.

## Handler context

```ts
type RouteHandlerContext = {
    params: TParams
    locals: TLocals
    meta: RouteMeta
    body?: TBody
    query?: TQuery
}
```

`body` and `query` are present when their route option is declared. The
first handler parameter remains the native `Request`.

## Built-in resolvers

| Resolver                      | Result                                 |
| ----------------------------- | -------------------------------------- |
| `jsonBody<T>()` / `body<T>()` | lazily parsed JSON                     |
| `textBody()`                  | lazily read text                       |
| `query<T>()`                  | query map; repeated keys become arrays |
| `defineInputSource()`         | reusable body/query lazy resolver      |

Params and headers are read directly from `context.params` and
`request.headers`; URL and cookie access stay on the native `request` as well.

## Component contracts

```ts
type RouteMiddleware = {
    name: string
    use(context, next): unknown | Promise<unknown>
}

type Guard = {
    name: string
    canActivate(context): boolean | Response | Promise<boolean | Response>
}

type Pipe = {
    name: string
    transform(value, metadata, context): unknown | Promise<unknown>
}

type Interceptor = {
    name: string
    intercept(context, next): unknown | Promise<unknown>
}

type ExceptionFilter = {
    name: string
    catch(error, context): Response | undefined | Promise<Response | undefined>
}
```

`ArgumentMetadata.type` is `body`, `query`, `params`, `headers`, or
`custom`. A Pipe can ignore values it does not own.

## Stable API response contract

```ts
const apiRoute = createRoute({
    plugins: [
        apiResponsePlugin({
            success: ResponseCode.SUCCESS,
            systemError: ResponseCode.INTERNAL_ERROR,
            mapError: (error, context) => {
                // Optional adapters can map their own errors here.
                return undefined
            },
        }),
    ],
})

throw new ApiException(ResponseCode.RESOURCE_NOT_FOUND, {
    data: { resourceId },
})
```

`apiResponsePlugin()` contributes a success Interceptor and an exception Filter.
It emits `{ code, msg, data }`, catches unexpected errors with the configured
`systemError`, and preserves native `Response` values. `ResponseCodeDefinition` has
`code`, `msg`, and an optional HTTP `status`; `ApiException` accepts optional
`message`, `data`, `status`, and `cause` overrides. See the [API response guide](api-response.md)
for the full contract and migration example.

`mapError(error, context)` is optional and returns either `undefined` or an
application-owned mapping:

```ts
type ApiResponseErrorMapping = {
    code: ResponseCodeDefinition
    status?: number
    message?: string
    data?: Readonly<Record<string, unknown>>
}
```

This hook is the adapter boundary. For example, an optional Zod package can map
`ZodValidationError` here without making `next-route-kit` depend on Zod. The
standalone Zod ExceptionFilter remains a separate choice for routes that do not
use the shared API envelope.
