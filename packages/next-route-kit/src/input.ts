import type { InputMetadata, MaybePromise, RouteParams } from '@next-route-kit/core'
import type { DefaultRouteState, RouteInputContext, RouteInputResolver } from './types.js'

export type InputSourceResolver<TValue, TParams extends RouteParams = RouteParams, TState = DefaultRouteState> = (
    context: RouteInputContext<TParams, TState>,
) => MaybePromise<TValue>

/** A request input capability that can be composed into a route input object. */
export class InputSource<TValue = unknown, TParams extends RouteParams = RouteParams, TState = DefaultRouteState> {
    readonly kind = 'route-input-source' as const

    constructor(
        readonly name: string,
        readonly location: InputMetadata['location'],
        private readonly resolver: InputSourceResolver<TValue, TParams, TState>,
    ) {}

    resolve(context: RouteInputContext<TParams, TState>): MaybePromise<TValue> {
        return this.resolver(context)
    }
}

export type QueryInput = Readonly<Record<string, string | readonly string[]>>

export type RouteInputSourceMap<TParams extends RouteParams = RouteParams, TState = DefaultRouteState> = Readonly<
    Record<string, InputSource<unknown, TParams, TState>>
>

export type ResolvedRouteInput<TDefinition> =
    TDefinition extends RouteInputResolver<any, infer TResult, any>
        ? TResult
        : TDefinition extends InputSource<infer TValue, any, any>
          ? TValue
          : TDefinition extends Readonly<Record<string, unknown>>
            ? {
                  readonly [Key in keyof TDefinition]: TDefinition[Key] extends InputSource<infer TValue, any, any> ? TValue : TDefinition[Key]
              }
            : TDefinition

export type RouteInputDefinition<TDefinition, TParams extends RouteParams = RouteParams, TState = DefaultRouteState> =
    TDefinition | RouteInputResolver<TParams, ResolvedRouteInput<TDefinition>, TState>

export function defineInputSource<TValue, TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(
    name: string,
    location: InputMetadata['location'],
    resolver: InputSourceResolver<TValue, TParams, TState>,
): InputSource<TValue, TParams, TState> {
    return new InputSource(name, location, resolver)
}

export function jsonBody<TValue = unknown, TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<TValue, TParams, TState> {
    return defineInputSource('json-body', 'body', ({ readBody }) => readBody<TValue>())
}

export function body<TValue = unknown, TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<TValue, TParams, TState> {
    return jsonBody<TValue, TParams, TState>()
}

export function textBody<TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<string, TParams, TState> {
    return defineInputSource('text-body', 'body', ({ readText }) => readText())
}

export function query<TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<QueryInput, TParams, TState> {
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

        return Object.freeze(Object.fromEntries(values))
    })
}

export function params<TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<TParams, TParams, TState> {
    return defineInputSource('params', 'params', ({ params: routeParams }) => routeParams)
}

export function headers<TParams extends RouteParams = RouteParams, TState = DefaultRouteState>(): InputSource<Headers, TParams, TState> {
    return defineInputSource('headers', 'headers', ({ request }) => new Headers(request.headers))
}
