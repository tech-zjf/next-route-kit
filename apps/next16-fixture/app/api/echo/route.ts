import { jsonBody } from 'next-route-kit'
import { route } from '@/src/route'

type EchoInput = {
    message: string
}

export const POST = route({
    input: jsonBody<EchoInput>(),
    handler: ({ input }) => ({ echo: input.message }),
})
