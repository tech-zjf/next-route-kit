import { params } from 'next-route-kit'
import { route } from '@/src/route'

type Params = {
    id: string
}

export const GET = route({
    input: params<Params>(),
    handler: ({ input }) => ({ id: input.id }),
})
