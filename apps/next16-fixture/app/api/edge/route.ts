import { query } from 'next-route-kit'
import { route } from '@/src/route'

export const runtime = 'edge'

export const GET = route({
    runtime: 'edge',
    input: query(),
    handler: ({ input, meta }) => ({ runtime: meta.runtime, query: input }),
})
