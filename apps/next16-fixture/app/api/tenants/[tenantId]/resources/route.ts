import { jsonBody, query } from 'next-route-kit'
import { resourceRoute } from '@/src/route'

type ResourceParams = {
    tenantId: string
}

type ResourceBody = {
    label: string
    size: number
}

type ResourceQuery = {
    preview?: string
}

export const POST = resourceRoute<ResourceParams, ResourceBody, ResourceQuery>({
    body: jsonBody<ResourceBody>(),
    query: query<ResourceQuery>(),
    handler: (_request, { params, body, query: values, locals }) => ({
        resourceId: 'resource-' + locals.userId + '-' + body.label,
        tenantId: params.tenantId,
        userId: locals.userId,
        label: body.label,
        size: body.size,
        preview: values.preview ?? 'false',
    }),
})
