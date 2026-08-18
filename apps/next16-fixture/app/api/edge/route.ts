import { query } from 'next-route-kit'
import { route } from '@/src/route'

export const runtime = 'edge'

type EdgeQuery = {
    mode?: string
}

export const GET = route({
    runtime: 'edge',
    query: query<EdgeQuery>(),
    handler: (_request, { query: values, meta }) => ({ runtime: meta.runtime, query: values }),
})
