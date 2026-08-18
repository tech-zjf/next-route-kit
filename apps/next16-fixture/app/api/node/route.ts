import { query } from 'next-route-kit'
import { route } from '@/src/route'

export const runtime = 'nodejs'

type NodeQuery = {
    mode?: string
}

export const GET = route({
    runtime: 'nodejs',
    query: query<NodeQuery>(),
    handler: (_request, { query: values, meta }) => ({ runtime: meta.runtime, query: values }),
})
