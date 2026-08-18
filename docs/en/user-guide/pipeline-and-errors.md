# Pipeline, errors, and responses

**English** · [简体中文](../../zh-CN/user-guide/pipeline-and-errors.md)

## Order

```text
Next params hydration
  → Middleware.use()
  → Guard.canActivate()
  → Interceptor.intercept() enter
  → declared argument resolution
  → Pipe.transform()
  → Handler
  → Interceptor exit
  → response serialization

ExceptionFilter.catch() handles failures from the chain.
```

## Middleware

```ts
const requestId: RouteMiddleware<ApiContext> = {
    name: 'request-id',
    use(context, next) {
        context.locals.requestId = crypto.randomUUID()
        return next()
    },
}
```

Middleware wraps downstream execution and must call `next()`. Calling it twice
throws `DuplicateMiddlewareNextError`.

## Guard

```ts
const requireUser: Guard<ApiContext> = {
    name: 'require-user',
    canActivate(context) {
        if (!context.request.headers.get('authorization')) {
            throw unauthorized()
        }
        return true
    },
}
```

A Guard can return `false`, a native `Response`, or throw `HttpError`.
It runs before body/query resolution.

## Interceptor

```ts
const envelope: Interceptor<ApiContext> = {
    name: 'envelope',
    async intercept(context, next) {
        const value = await next()

        if (value instanceof Response) {
            return value
        }

        return { data: value, requestId: context.locals.requestId }
    },
}
```

Code before `next()` is the enter phase; code after `await next()` is the
exit phase. If the downstream handler returns a native `Response`, preserve it
so its status, headers, and body remain unchanged.

## ExceptionFilter

```ts
const filter: ExceptionFilter<ApiContext> = {
    name: 'api-errors',
    catch(error, context) {
        if (!(error instanceof HttpError)) return undefined
        return Response.json({ code: error.code, message: error.message, requestId: context.locals.requestId }, { status: error.status })
    },
}
```

Filters run from the route-local scope outward. Returning `undefined` passes
the error to the next filter. The default filter handles built-in `HttpError`
and malformed JSON.

## Responses

Plain values use `jsonResponse()`. A native `Response` passes through
unchanged, so streams, files, redirects, and explicit `204` responses stay
native.
