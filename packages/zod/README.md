# @next-route-kit/zod

Optional Zod validation for `next-route-kit`. The adapter is not imported by
Core or the Next.js package, so applications opt in only when they use Zod.

```bash
pnpm add @next-route-kit/zod zod
```

See the [English input and validation guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/input-and-validation.md)
or [简体中文输入与校验指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/input-and-validation.md).

```ts
import { z } from 'zod'
import { createRoute, jsonBody } from 'next-route-kit'
import { zodErrorMapper, zodPipe } from '@next-route-kit/zod'

const bodySchema = z.object({
    name: z.string().min(1),
})

const route = createRoute({
    inputPipes: [zodPipe(z.object({ body: bodySchema }))],
    errorMappers: [zodErrorMapper()],
})

export const POST = route({
    input: { body: jsonBody<z.input<typeof bodySchema>>() },
    handler: ({ input }) => ({ name: input.body.name }),
})
```

`zodPipe(schema)` runs after the Route Factory resolves `input`. Successful
parsing replaces the current input with the parsed output. Failed parsing
throws `ZodValidationError`; register `zodErrorMapper()` globally, on a scope,
or on an individual route to turn it into a JSON response. The default status
is `400`; use `{ status: 422 }` when your API policy prefers that status.

The package declares Zod as a peer dependency and supports Zod 4. Core remains
validator-agnostic, and the adapter uses the async parse API so schemas with
async refinements work as expected.

See the [English input and validation guide](https://github.com/tech-zjf/next-route-kit/blob/main/docs/en/user-guide/input-and-validation.md)
or [简体中文输入与校验指南](https://github.com/tech-zjf/next-route-kit/blob/main/docs/zh-CN/user-guide/input-and-validation.md)
for mapper ordering and the [0.1.0 release notes](https://github.com/tech-zjf/next-route-kit/blob/main/docs/release/v0.1.0.md)
for the supported adapter baseline.
