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

`zodExceptionFilter()` implements `ExceptionFilter` and maps
`ZodValidationError` to JSON. The default status is `400`; applications that
use `422` can configure `{ status: 422 }`.

The adapter is opt-in, keeps Core validator-agnostic, and uses Zod's async parse
API so async refinements work.
