import { route } from '@/src/route'

type Params = {
    id: string
}

export const GET = route<Params>({
    handler: (_request, { params }) => ({ id: params.id }),
})
