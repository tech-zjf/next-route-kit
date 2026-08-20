# @next-route-kit/zod

Optional Zod 4 adapter for `next-route-kit`.

```bash
npm install @next-route-kit/zod zod
```

```ts
import { z } from 'zod'
import { createRoute, jsonBody } from 'next-route-kit'
import { zodExceptionFilter, zodPipe } from '@next-route-kit/zod'

const schema = z.object({ name: z.string().min(1) })

const route = createRoute({
    pipes: [zodPipe(schema, { appliesTo: 'body' })],
    exceptionFilters: [zodExceptionFilter({ status: 422 })],
})

export const POST = route({
    body: jsonBody<z.input<typeof schema>>(),
    handler: (_request, { body }) => ({ name: body.name }),
})
```

`zodPipe(schema)` implements Core's `Pipe` contract and receives
`ArgumentMetadata`. It validates each resolved argument. Use
`{ appliesTo: 'body' }` or `{ appliesTo: 'query' }` when one scope declares
more than one schema.

Validation errors expose only stable `code`, `message`, and `path` issue fields.
Rejected input is not retained by default because request values may contain
credentials or personal data. For a controlled debugging environment only,
`zodPipe(schema, { captureInput: true })` retains it on
`ZodValidationError.input`.

`zodExceptionFilter()` implements `ExceptionFilter` and maps
`ZodValidationError` to an adapter-specific JSON response. The default status is
`400`; applications that use `422` can configure `{ status: 422 }`. It is
optional and should be used as the route's error boundary only when the route is
not already using `apiResponsePlugin()`.

For a route that uses the shared `{ code, msg, data }` envelope, keep this filter
out and map the error through the main package's generic `mapError` option:

```ts
import { apiResponsePlugin, createRoute } from 'next-route-kit'
import { ZodValidationError, zodPipe } from '@next-route-kit/zod'

const route = createRoute({
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

The adapter is opt-in, keeps Core validator-agnostic, and uses Zod's async parse
API so async refinements work.
