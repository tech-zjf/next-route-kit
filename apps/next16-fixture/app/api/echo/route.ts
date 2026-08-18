import { jsonBody } from 'next-route-kit'
import { route } from '@/src/route'

type EchoInput = {
    message: string
}

export const POST = route({
    body: jsonBody<EchoInput>(),
    handler: (_request, { body }) => ({ echo: body.message }),
})
