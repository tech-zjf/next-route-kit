# Stable API response contracts

[简体中文](../../zh-CN/user-guide/api-response.md) · **English**

Many production APIs need one response contract so the client can make one
decision at the transport boundary and a more specific decision for a business
code. `next-route-kit` provides this as an opt-in plugin; it does not force
streaming, upload, webhook, or other native `Response` routes into the JSON
contract.

## Define codes in the application

The package does not own your domain codes. Keep them in an application-owned
response-code module:

```ts
export const ResponseCode = {
    SUCCESS: { code: 'OK', msg: 'Success' },
    QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', msg: 'Quota exceeded', status: 409 },
    RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', msg: 'Resource not found', status: 404 },
    INVALID_INPUT: { code: 'INVALID_INPUT', msg: 'Invalid input', status: 422 },
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', msg: 'Internal server error' },
} as const
```

`code` is the stable business contract. `status`, when present, is only the
HTTP transport status used for that exception; it is not emitted as the API
business code.

## Register the contract once

Install the plugin on the base Factory. Every derived and route-local Handler
inherits the same success and error shape:

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

The Handler returns business data and throws a business exception. It does not
construct `NextResponse`, repeat `code`/`msg`, or catch every Service error.

## The wire contract

Successful object results become:

```json
{
    "code": "OK",
    "msg": "Success",
    "data": {
        "resourceId": "resource-demo"
    }
}
```

An expected business error becomes:

```json
{
    "code": "QUOTA_EXCEEDED",
    "msg": "Quota exceeded",
    "data": {
        "requested": 10,
        "available": 3
    }
}
```

`data` is always an object. For a list endpoint, return an object such as
`{ items, total, nextCursor }`, or provide `mapData` once in the plugin:

```ts
const apiContract = apiResponsePlugin({
    success: ResponseCode.SUCCESS,
    systemError: ResponseCode.INTERNAL_ERROR,
    mapData: (value) => ({ items: value }),
})
```

Primitive results are represented as `{ value }` by the default mapper. This
keeps the contract predictable, while `mapData` makes the intended list or
pagination shape visible at the shared boundary.

## Global and business error handling

The server package does not decide whether a browser should show a global toast
or a feature-specific dialog. It gives the client one stable discriminator:

```ts
if (payload.code === ResponseCode.QUOTA_EXCEEDED.code) {
    // The current feature can show quota details or an upgrade action.
    showQuotaDialog(payload.data)
}
```

The client request layer can handle common codes such as authentication,
permission, quota, and system failure globally. A feature can register a
handler for its own codes without guessing whether the server returned a
number, string, `message`, or `msg` field.

Unexpected errors are converted to `systemError`; their internal message is not
sent to the client. Use `onUnknownError` for logging, tracing, or Sentry.

## What maps from an existing Next API

| Repeated code in a hand-written Route                     | Shared contract version                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `NextResponse.json({ ...API_RESPONSE.SUCCESS, data })`    | `return data`                                                          |
| `NextResponse.json({ ...API_RESPONSE.BAD_REQUEST, msg })` | `throw new ApiException(ResponseCode.INVALID_INPUT, { message: msg })` |
| `try/catch` in every Route                                | `systemError` in one plugin                                            |
| `handleApiError(error)` switch in every feature           | `ApiException` in the Service plus `mapErrorData` when needed          |
| client branches on HTTP status and mixed `code` types     | client branches on one typed business `code`                           |

Keep native handlers for streams, multipart uploads, signed webhooks, redirects,
and other protocols where an envelope would be incorrect. The goal is to make
repeated JSON CRUD/auth routes easier to read, not to wrap every response.
