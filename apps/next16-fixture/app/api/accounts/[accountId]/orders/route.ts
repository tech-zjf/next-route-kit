import { jsonBody, params, query } from 'next-route-kit'
import { orderRoute } from '@/src/route'

type OrderParams = {
    accountId: string
}

type OrderBody = {
    sku: string
    quantity: number
}

export const POST = orderRoute({
    input: {
        account: params<OrderParams>(),
        body: jsonBody<OrderBody>(),
        query: query(),
    },
    handler: ({ input, state }) => ({
        orderId: `order-${state.userId}-${input.body.sku}`,
        accountId: input.account.accountId,
        sku: input.body.sku,
        quantity: input.body.quantity,
        preview: input.query.preview ?? 'false',
    }),
})
