import { query } from 'next-route-kit'
import { route } from '@/src/route'

export const runtime = 'nodejs'

export const GET = route({
    runtime: 'nodejs',
    input: query(),
    handler: ({ input, meta }) => ({ runtime: meta.runtime, query: input }),
})
