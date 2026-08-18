# API reference

[简体中文](../../zh-CN/user-guide/api-reference.md) · **English**

This page describes the public exports that most application developers use.
The generated TypeScript declarations are the final type contract.

## `createRoute`

```ts
createRoute<TState = Record<string, never>>(
    config?: RouteFactoryConfig<TState>,
): RouteFactory<TState>
```

`createRoute` is a callable root Factory. It accepts a configuration object and
returns a callable `route` Factory:

```ts
const route = createRoute({ response: jsonResponse() })
const GET = route({ handler: () => ({ ok: true }) })
```

The `TState` generic describes request-local state written by Middleware or
Guards and read by later stages:

```ts
type State = { requestId: string }
const route = createRoute<State>({ middleware: [requestIdMiddleware] })
```

## `route(options)` and `Factory.create(options)`

```ts
route<TParams, TInput, TResult>(options: RouteOptions<TParams, TInput, TState, TResult>): NextRouteHandler<TParams>
```

The same compilation is available as `factory.create(options)`. The callable
form is recommended for Route Handler files.

### Handler context

```ts
type RouteContext<TParams, TInput, TState> = {
    request: Request
    params: TParams
    input: TInput
    inputMetadata?: InputMetadata
    state: TState
    meta: RouteMeta
}
```

`params` is already resolved when the handler runs. `request` is the Web API
`Request`; `input` is the value produced by the route input definition; `state`
is request-local; `meta` contains optional method, pathname, and runtime data.

### Route input definition

`input` accepts one of these forms:

| Form         | Example                                             | Result                                                           |
| ------------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| Direct value | `input: { source: 'cache' }`                        | The value is passed to Pipes and the handler.                    |
| Resolver     | `input: ({ request }) => request.url`               | The resolver runs after Guards.                                  |
| One source   | `input: jsonBody<Body>()`                           | The source resolves one value.                                   |
| Source map   | `input: { body: jsonBody<Body>(), query: query() }` | Each source resolves into a field. Literal fields are preserved. |

## `Factory.extend`

```ts
extend(config: RouteFactoryConfig<TState>): RouteFactory<TState>
```

Returns an immutable child Factory. Arrays append according to the merge rules;
Error Mappers receive local-first priority; a local serializer replaces its
parent.

## Input helpers

| Export              | Signature                    | Returns                                                               |
| ------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `jsonBody`          | `jsonBody<T>()`              | Lazily parsed JSON body of type `T`.                                  |
| `body`              | `body<T>()`                  | Alias of `jsonBody<T>()`.                                             |
| `textBody`          | `textBody()`                 | Lazily read body text as `string`.                                    |
| `query`             | `query()`                    | Frozen object of string values; repeated keys become readonly arrays. |
| `params`            | `params<TParams>()`          | Resolved dynamic route params.                                        |
| `headers`           | `headers()`                  | A copy of the request headers as `Headers`.                           |
| `defineInputSource` | `(name, location, resolver)` | A custom reusable `InputSource`.                                      |

Input sources expose `name` and a metadata `location` of `body`, `query`,
`params`, `headers`, or `custom`. Input Pipes receive this metadata.

## `jsonResponse`

```ts
jsonResponse<TContext = RouteContext>(options?: JsonResponseOptions<TContext>): ResponseSerializer
```

| Option      | Type                                          | Default  | Meaning                                            |
| ----------- | --------------------------------------------- | -------- | -------------------------------------------------- |
| `status`    | `number`                                      | `200`    | Status used for ordinary serialized values.        |
| `headers`   | `HeadersInit`                                 | none     | Additional response headers.                       |
| `transform` | `(value, context) => value \| Promise<value>` | identity | Transforms a handler value before `Response.json`. |

`Response` instances bypass the serializer. Returning `undefined` is rejected;
return a JSON value or a native `Response` instead.

## Errors

```ts
new HttpError({
    status: 422,
    code: 'INVALID_USER',
    message: 'User data is invalid',
    details: { field: 'email' },
})
```

Convenience constructors:

```ts
unauthorized() // 401, UNAUTHORIZED
forbidden() // 403, FORBIDDEN
```

The main package's default mapper serializes `HttpError` as:

```json
{
    "code": "UNAUTHORIZED",
    "message": "Authentication is required"
}
```

`InvalidJsonBodyError` is returned as a `400 INVALID_JSON` response when
`jsonBody()` or `readBody()` cannot parse the request body.

## Pipeline component contracts

All components require a stable `name` for diagnostics.

```ts
type RouteMiddleware = {
    name: string
    handle(context, next): value | Promise<value>
}

type Guard = {
    name: string
    canActivate(context): boolean | Response | Promise<boolean | Response>
}

type InputPipe = {
    name: string
    transform(value, metadata, context): value | Promise<value>
}

type Interceptor = {
    name: string
    intercept(context, next): Promise<value>
}

type ErrorMapper = {
    name: string
    map(error, context): Response | undefined | Promise<Response | undefined>
}
```

## Runtime and plugins

```ts
type RouteRuntime = 'nodejs' | 'edge'
type RuntimeSupport = 'nodejs' | 'edge' | 'both'

type RoutePlugin = {
    name: string
    runtime?: RuntimeSupport
    install(): RoutePluginContribution
}
```

The Factory checks a plugin's declared runtime when `runtime` is configured.
This is an early diagnostic, not a replacement for Next.js bundle checks.

`install()` may return any of these contribution properties:

| Property             | Meaning                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `middleware`         | Middleware appended to the current scope.                                                                       |
| `guards`             | Guards appended to the current scope.                                                                           |
| `inputPipes`         | Input Pipes appended to the current scope.                                                                      |
| `interceptors`       | Interceptors appended to the current scope.                                                                     |
| `errorMappers`       | Error Mappers appended with the normal local-priority rules.                                                    |
| `responseSerializer` | One serializer contribution; multiple plugin serializers in one scope throw `DuplicateResponseSerializerError`. |
