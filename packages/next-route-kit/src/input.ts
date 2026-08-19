import type { MaybePromise, RouteParams, RouteParamsConstraint } from '@next-route-kit/core'
import type { DefaultRouteLocals, RouteInputContext, RouteInputResolver } from './types.js'

export type InputSourceResolver<TValue, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals> = (
    context: RouteInputContext<TParams, TLocals>,
) => MaybePromise<TValue>

export type RouteInputLocation = 'body' | 'query'

/** An advanced request value resolver used by the optional body/query route fields. */
export class InputSource<TValue = unknown, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals> {
    readonly kind = 'route-input-source' as const

    constructor(
        readonly name: string,
        readonly location: RouteInputLocation,
        private readonly resolver: InputSourceResolver<TValue, TParams, TLocals>,
    ) {}

    resolve(context: RouteInputContext<TParams, TLocals>): MaybePromise<TValue> {
        return this.resolver(context)
    }
}

export type QueryInput = Readonly<Record<string, string | readonly string[]>>

export type RouteInputDefinition<TValue, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals> =
    InputSource<TValue, any, any> | RouteInputResolver<TParams, TValue, TLocals>

export function defineInputSource<TValue, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals>(
    name: string,
    location: RouteInputLocation,
    resolver: InputSourceResolver<TValue, TParams, TLocals>,
): InputSource<TValue, TParams, TLocals> {
    return new InputSource(name, location, resolver)
}

export function jsonBody<TValue = unknown, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals>(): InputSource<
    TValue,
    TParams,
    TLocals
> {
    return defineInputSource('json-body', 'body', ({ readBody }) => readBody<TValue>())
}

export function body<TValue = unknown, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals>(): InputSource<
    TValue,
    TParams,
    TLocals
> {
    return jsonBody<TValue, TParams, TLocals>()
}

export function textBody<TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals>(): InputSource<string, TParams, TLocals> {
    return defineInputSource('text-body', 'body', ({ readText }) => readText())
}

export function query<TValue = QueryInput, TParams extends RouteParamsConstraint<TParams> = RouteParams, TLocals = DefaultRouteLocals>(): InputSource<
    TValue,
    TParams,
    TLocals
> {
    return defineInputSource('query', 'query', ({ request }) => {
        const values = new Map<string, string | readonly string[]>()
        new URL(request.url).searchParams.forEach((value, key) => {
            const previous = values.get(key)

            if (previous === undefined) {
                values.set(key, value)
                return
            }

            if (typeof previous === 'string') {
                values.set(key, Object.freeze([previous, value]))
                return
            }

            const repeatedValues = [...previous, value]
            values.set(key, Object.freeze(repeatedValues))
        })

        return Object.freeze(Object.fromEntries(values)) as TValue
    })
}
