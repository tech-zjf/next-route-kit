# next-route-kit

The Next.js App Router entry package.

```bash
npm install next-route-kit
```

Start with the [English user guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/README.md),
[简体中文指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/README.md),
or the [repository README](https://github.com/tech-zjf/next-route-kit#readme).

## 5-minute integration

Try one JSON endpoint first. No `next.config.ts` registration is required.

```ts
// app/api/resources/route.ts
import { createRoute, jsonBody } from 'next-route-kit'

const route = createRoute()

export const POST = route({
    body: jsonBody<{ name: string }>(),
    handler: (_request, { body }) => ({ resource: { name: body.name } }),
})
```

`request` remains the native Web `Request`, and special endpoints can stay plain
Next.js handlers. Migrate one route at a time; see the [migration guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/migration.md)
for a before/after example.

## Production adoption and compatibility feedback

If your App Router project repeats authentication, validation, error mapping, or
response-envelope policy, migrate one representative route and extend the shared
Factory as the pattern proves useful. For a migration or compatibility report,
include your Next.js version, runtime, migrated route shape, and the relevant API
or documentation area in the [compatibility and migration issue form](https://github.com/tech-zjf/next-route-kit/issues/new/choose).

## Native route API

```ts
import { createRoute, jsonBody, query } from 'next-route-kit'

type ResourceParams = { id: string }
type UpdateInput = { title?: string }

const route = createRoute({
    guards: [requireUser],
})

export const GET = route<ResourceParams>({
    handler: async (request, { params, locals }) => {
        return resourceService.find(params.id, locals.userId)
    },
})

export const PATCH = route<ResourceParams, UpdateInput>({
    body: jsonBody<UpdateInput>(),
    handler: async (_request, { params, body, locals }) => {
        return resourceService.update(params.id, locals.userId, body)
    },
})
```

The handler is always `(request, context)`. `request` is the native Web
`Request`; `context.params` contains Next dynamic params and
`context.locals` contains request-local values written by middleware or guards.

Declare `body` or `query` only when automatic resolution is useful:

```ts
export const POST = route({
    body: jsonBody<{ name: string }>(),
    query: query<{ preview?: string }>(),
    handler: (_request, { body, query: values }) => ({
        name: body.name,
        preview: values.preview === 'true',
    }),
})
```

Raw headers, URL, streaming bodies, files, and special responses remain on the
native `Request`/`Response` boundary.

## Factory scopes

```ts
const apiRoute = createRoute({ middleware, interceptors, exceptionFilters })
const authenticatedRoute = apiRoute.extend({ guards: [requireUser] })
```

`extend()` returns a new immutable scope. It does not mutate the parent and
does not require a `next.config.ts` registration.

## Stable API responses

For applications that use a business-code contract, register the optional
plugin once:

```ts
import { ApiException, apiResponsePlugin, createRoute } from 'next-route-kit'

const ResponseCode = {
    SUCCESS: { code: 'OK', msg: 'Success' },
    QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', msg: 'Quota exceeded', status: 409 },
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', msg: 'Internal server error' },
} as const

const apiRoute = createRoute({
    plugins: [apiResponsePlugin({ success: ResponseCode.SUCCESS, systemError: ResponseCode.INTERNAL_ERROR })],
})

export const POST = apiRoute({
    handler: async () => {
        if (/* application rule */ false) {
            throw new ApiException(ResponseCode.QUOTA_EXCEEDED)
        }

        return { resourceId: 'resource-demo' }
    },
})
```

Plain object results and `ApiException` values are converted to one
`{ code, msg, data }` envelope. `data` is always an object. The code constants
remain application-owned, so a client can handle common auth/quota codes
globally and feature-specific codes locally. Native `Response` values pass
through unchanged. Unexpected errors use the configured system response and are
reported with `console.error` unless `onUnknownError` supplies an application
reporter.

Validation is not built into this response contract. The main package does not
depend on Zod or register a Zod filter. If an application installs the optional
`@next-route-kit/zod` adapter, use `apiResponsePlugin({ mapError })` to map
`ZodValidationError` into the envelope. Use `zodExceptionFilter()` instead only
for a route that intentionally uses the adapter's standalone JSON shape.

The pipeline is:

```text
Next params → Middleware → Guard → Interceptor enter
→ declared arguments → Pipe → Handler → Interceptor exit → Response
```

Errors go through `ExceptionFilter.catch()`. The package supplies a default
filter for `HttpError` and malformed JSON, plus a default JSON serializer. A
native `Response` returned by a handler passes through unchanged.

See the root README for RESTful examples and the user guides for API details.

## Custom plugins

Create a class that implements `RoutePlugin` and return reusable lifecycle
components from `install()`:

```ts
import { createRoute, type RoutePlugin } from 'next-route-kit'

class RequestTimingPlugin implements RoutePlugin {
    readonly name = 'request-timing'
    readonly runtime = 'both' as const

    install() {
        return {
            interceptors: [
                {
                    name: 'request-timing',
                    async intercept(_context, next) {
                        const startedAt = Date.now()

                        try {
                            return await next()
                        } finally {
                            console.info('durationMs:', Date.now() - startedAt)
                        }
                    },
                },
            ],
        }
    }
}

const route = createRoute({
    plugins: [new RequestTimingPlugin()],
})
```

Plugins can contribute middleware, guards, pipes, interceptors,
exceptionFilters, or one responseSerializer. Register them on the base Factory,
on `extend()` for a subgroup, or with route-local `use: [plugin]`. The detailed
[plugin guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/plugins.md)
documents the lifecycle order and scope rules.
