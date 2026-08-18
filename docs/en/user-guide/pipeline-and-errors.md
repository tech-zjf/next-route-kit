# Pipeline, errors, and responses

[简体中文](../../zh-CN/user-guide/pipeline-and-errors.md) · **English**

## Execution order

Every compiled route follows this order:

```text
Next params hydration
  → Middleware
  → Guard
  → Input Resolver
  → Input Pipe
  → Interceptor
  → Handler
  → Response Serializer
```

The order is intentional:

- dynamic params are available to authorization before the body is read;
- Guards can reject an unauthorized request without parsing input;
- Input Pipes receive resolved input and can transform it;
- Interceptors wrap the handler and can observe the final value;
- the serializer handles ordinary return values after the handler completes.

## Middleware

Middleware can update request-local state and must call `next()` to continue:

```ts
import type { AnyRouteContext, RouteMiddleware } from 'next-route-kit'

type State = { requestId: string }

const requestIdMiddleware: RouteMiddleware<AnyRouteContext<State>> = {
    name: 'request-id',
    async handle(context, next) {
        context.state.requestId = crypto.randomUUID()
        return next()
    },
}
```

Middleware may short-circuit by returning a `Response`, but it should not call
`next()` more than once. Calling it twice throws `DuplicateMiddlewareNextError`.

## Guards

Guards run before `input` resolution:

```ts
import { unauthorized, type AnyRouteContext, type Guard } from 'next-route-kit'

const requireUser: Guard<AnyRouteContext> = {
    name: 'require-user',
    canActivate({ request }) {
        if (!request.headers.get('authorization')) {
            throw unauthorized()
        }

        return true
    },
}
```

Returning `false` produces the default `403 FORBIDDEN` error. Throw
`unauthorized()` for a missing identity (`401`) and `forbidden()` for an
identity that lacks permission (`403`). A Guard may also return a native
`Response` to short-circuit with a custom response.

Guards can read hydrated `context.params`, `request`, and request-local state.
They should not expect `context.input` to be resolved yet.

## Input Pipes

An Input Pipe receives the current input, source metadata, and context:

```ts
const trimName = {
    name: 'trim-name',
    transform(value: { name: string }) {
        return { name: value.name.trim() }
    },
}
```

Pipes run in registration order. Each Pipe receives the previous Pipe's output.
Use an optional package such as `@next-route-kit/zod` for schema validation.

## Interceptors

Interceptors wrap later stages and should normally await and return `next()`:

```ts
const timing = {
    name: 'timing',
    async intercept(context, next) {
        const startedAt = Date.now()
        const result = await next()
        console.info(context.meta.pathname, Date.now() - startedAt)
        return result
    },
}
```

When several Interceptors are registered, they enter in registration order and
unwind in reverse order.

## Error Mappers

An Error Mapper returns a `Response` for errors it owns and `undefined` for all
others:

```ts
const applicationErrors = {
    name: 'application-errors',
    map(error: unknown) {
        if (error instanceof ApplicationError) {
            return Response.json({ code: error.code, message: error.message }, { status: error.status })
        }

        return undefined
    },
}
```

The lookup order is:

```text
Route → Scope → Global → built-in default mapper
```

The default mapper handles `HttpError` and malformed JSON. Unexpected errors
are rethrown to Next.js instead of exposing internal error details through the
library.

## Response serialization

The default serializer behaves as follows:

| Handler result        | Behavior                        |
| --------------------- | ------------------------------- |
| `Response`            | Returned unchanged.             |
| JSON-compatible value | Converted with `Response.json`. |
| `undefined`           | Rejected with a `TypeError`.    |
| Stream, Blob, or File | Return an explicit `Response`.  |

Use `jsonResponse({ transform, status, headers })` to define a shared response
shape:

```ts
const route = createRoute({
    response: jsonResponse({
        transform: (data) => ({ code: 0, data }),
    }),
})
```

An explicit Response returned by a handler is never wrapped a second time.
