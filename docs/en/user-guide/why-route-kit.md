# Why use next-route-kit?

[简体中文](../../zh-CN/user-guide/why-route-kit.md) · **English**

`next-route-kit` is useful when a project has more than a few Route Handlers
and the same request concerns start appearing in every `route.ts` file:
authentication, request IDs, input parsing, validation, response envelopes,
and error formats.

It keeps Next.js's file convention and native handler export, but moves those
cross-cutting concerns into reusable Factory scopes.

## The problem without a shared pipeline

Consider two endpoints in an order service. Without a shared pipeline, each
handler tends to repeat the same policy code and the order of that code is easy
to change accidentally:

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

The next endpoint usually copies the request ID, authentication, validation,
success envelope, and `try/catch` block. Over time this creates inconsistent
status codes, error payloads, logging, and security checks. It also makes it
hard to guarantee that authentication happens before a one-shot request body
is consumed.

## The same flow with a Factory

Create one application-owned base Factory for concerns shared by all API
routes. Then derive a scope for authenticated routes and another scope for
order input validation:

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

The Route Handler remains a normal Next.js file. It only declares the route's
input and business operation:

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

The request now has one explicit path:

```text
Next params hydration
  → Middleware: request ID and request-local state
  → Guard: authentication and authorization
  → Input Resolver: body, query, headers, and params
  → Input Pipe: validation and transformation
  → Interceptor: success envelope, timing, cache, or tracing
  → Handler: business logic only
  → Response Serializer: native JSON Response
```

An error skips the success Interceptor unwind and is handled by Error Mappers.
This makes the distinction clear: Interceptors shape successful execution,
while Error Mappers own the error contract.

## What this solves for a team

| Repeated problem                                        | Factory solution                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Every route creates its own request ID and logging code | Register Middleware once on the base Factory.                                     |
| Every protected route repeats authentication checks     | Derive `authenticatedRoute` with `extend({ guards })`.                            |
| Every handler parses and validates a body manually      | Compose `jsonBody()` and add a validation Input Pipe or the optional Zod adapter. |
| Response formats drift between endpoints                | Use one Interceptor and Response Serializer policy.                               |
| Errors have different shapes and status codes           | Register Error Mappers once and keep route code focused on business errors.       |
| Security checks accidentally read the body first        | Guards run before Input Resolver and one-shot body reads.                         |
| Next.js route files become framework-specific classes   | Keep native `app/**/route.ts` exports and use a small callable Factory.           |

## Verify the user journey, not just the Factory default

The repository includes a real order-flow test that checks:

- an authenticated request reaches the Handler with dynamic params, query, and JSON body;
- request ID and user ID are present in the unified success response;
- an unauthenticated request is rejected before malformed JSON is parsed;
- invalid order input becomes a stable `422` error with a request ID;
- the actual stage order is Middleware → Guard → Input Resolver → Input Pipe → Interceptor → Handler.

The same flow is exercised through real Next.js 15 and 16 Route Handlers in the
compatibility fixtures. See [testing](./testing.md) and the
[Next.js compatibility matrix](../../compatibility/next-matrix.md).
