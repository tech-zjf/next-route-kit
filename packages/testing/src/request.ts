import type { MaybePromise, NextRouteHandler, NextRouteHandlerContext, RouteParams, RouteParamsConstraint } from 'next-route-kit'

const DEFAULT_BASE_URL = 'https://example.test/'

export type QueryValue = string | number | boolean
export type QueryInit = Readonly<Record<string, QueryValue | readonly QueryValue[]>>

interface RequestBuilderOptions<TParams extends RouteParamsConstraint<TParams>> {
    readonly method?: string
    readonly headers?: HeadersInit
    readonly body?: BodyInit
    readonly params?: TParams
    readonly baseUrl?: string | URL
}

interface RequestBuilderState<TParams extends RouteParamsConstraint<TParams>> {
    readonly url?: URL
    readonly method?: string
    readonly headers?: Headers
    readonly body?: BodyInit
    readonly params?: TParams
}

export interface RouteTestRequest<TParams extends RouteParamsConstraint<TParams> = RouteParams> {
    readonly request: Request
    readonly context: NextRouteHandlerContext<TParams>
}

export type RouteTestHandler<TParams extends RouteParamsConstraint<TParams> = RouteParams> =
    NextRouteHandler<TParams> | ((request: Request, context: NextRouteHandlerContext<TParams>) => MaybePromise<Response>)

/** Immutable fluent builder for Web API Requests and Next Route Handler params. */
export class RequestBuilder<TParams extends RouteParamsConstraint<TParams> = RouteParams> {
    private readonly url: URL
    private readonly requestMethod: string
    private readonly requestHeaders: Headers
    private readonly requestBody: BodyInit | undefined
    private readonly routeParams: TParams

    constructor(url: string | URL = DEFAULT_BASE_URL, options: RequestBuilderOptions<TParams> = {}) {
        this.url = new URL(url.toString(), options.baseUrl ?? DEFAULT_BASE_URL)
        this.requestMethod = (options.method ?? 'GET').toUpperCase()
        this.requestHeaders = new Headers(options.headers)
        this.requestBody = options.body
        this.routeParams = snapshotParams(options.params ?? ({} as TParams))
    }

    static get<TParams extends RouteParamsConstraint<TParams> = RouteParams>(url: string | URL = DEFAULT_BASE_URL): RequestBuilder<TParams> {
        return new RequestBuilder<TParams>(url).method('GET')
    }

    static post<TParams extends RouteParamsConstraint<TParams> = RouteParams>(url: string | URL = DEFAULT_BASE_URL): RequestBuilder<TParams> {
        return new RequestBuilder<TParams>(url).method('POST')
    }

    method(method: string): RequestBuilder<TParams> {
        return this.clone({ method })
    }

    query(name: string, value: QueryValue | readonly QueryValue[]): RequestBuilder<TParams>
    query(values: QueryInit | URLSearchParams): RequestBuilder<TParams>
    query(nameOrValues: string | QueryInit | URLSearchParams, value?: QueryValue | readonly QueryValue[]): RequestBuilder<TParams> {
        const url = new URL(this.url.toString())

        if (typeof nameOrValues === 'string') {
            appendQueryValue(url.searchParams, nameOrValues, value as QueryValue | readonly QueryValue[])
        } else if (nameOrValues instanceof URLSearchParams) {
            const queryNames = new Set<string>()
            nameOrValues.forEach((_queryValue, queryName) => queryNames.add(queryName))

            for (const queryName of queryNames) {
                appendQueryValue(url.searchParams, queryName, nameOrValues.getAll(queryName))
            }
        } else {
            for (const [queryName, queryValue] of Object.entries(nameOrValues)) {
                appendQueryValue(url.searchParams, queryName, queryValue)
            }
        }

        return this.clone({ url })
    }

    header(name: string, value: string): RequestBuilder<TParams> {
        const headers = new Headers(this.requestHeaders)
        headers.set(name, value)
        return this.clone({ headers })
    }

    headers(values: HeadersInit): RequestBuilder<TParams> {
        const headers = new Headers(this.requestHeaders)
        new Headers(values).forEach((value, name) => headers.set(name, value))
        return this.clone({ headers })
    }

    json(value: unknown): RequestBuilder<TParams> {
        const body = JSON.stringify(value)

        if (body === undefined) {
            throw new TypeError('RequestBuilder.json() received a value that cannot be serialized')
        }

        const headers = new Headers(this.requestHeaders)
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json')
        }

        return this.clone({ body, headers })
    }

    text(value: string, contentType = 'text/plain;charset=UTF-8'): RequestBuilder<TParams> {
        const headers = new Headers(this.requestHeaders)
        if (!headers.has('content-type')) {
            headers.set('content-type', contentType)
        }

        return this.clone({ body: value, headers })
    }

    body(value: BodyInit, contentType?: string): RequestBuilder<TParams> {
        const headers = new Headers(this.requestHeaders)
        if (contentType && !headers.has('content-type')) {
            headers.set('content-type', contentType)
        }

        return this.clone({ body: value, headers })
    }

    params<TNextParams extends RouteParamsConstraint<TNextParams>>(params: TNextParams): RequestBuilder<TNextParams> {
        return this.clone<TNextParams>({ params })
    }

    build(): Request {
        const init: RequestInit =
            this.requestBody === undefined
                ? {
                      method: this.requestMethod,
                      headers: new Headers(this.requestHeaders),
                  }
                : {
                      method: this.requestMethod,
                      headers: new Headers(this.requestHeaders),
                      body: this.requestBody,
                  }

        return new Request(this.url, init)
    }

    buildContext(): NextRouteHandlerContext<TParams> {
        return {
            params: Promise.resolve(this.routeParams),
        }
    }

    buildRouteRequest(): RouteTestRequest<TParams> {
        return {
            request: this.build(),
            context: this.buildContext(),
        }
    }

    private clone<TNextParams extends RouteParamsConstraint<TNextParams> = TParams>(state: RequestBuilderState<TNextParams>): RequestBuilder<TNextParams> {
        const options: RequestBuilderOptions<TNextParams> = {
            method: state.method ?? this.requestMethod,
            headers: state.headers ?? new Headers(this.requestHeaders),
            params: state.params ?? (this.routeParams as unknown as TNextParams),
        }
        const body = state.body ?? this.requestBody

        const nextOptions: RequestBuilderOptions<TNextParams> =
            body === undefined
                ? options
                : {
                      ...options,
                      body,
                  }

        return new RequestBuilder(state.url ?? this.url, nextOptions)
    }
}

export function request(url: string | URL = DEFAULT_BASE_URL): RequestBuilder {
    return new RequestBuilder(url)
}

export async function invokeRoute<TParams extends RouteParamsConstraint<TParams> = RouteParams>(
    handler: RouteTestHandler<TParams>,
    input: Request | RequestBuilder<TParams> | RouteTestRequest<TParams>,
    context?: NextRouteHandlerContext<TParams>,
): Promise<Response> {
    const routeRequest = toRouteTestRequest(input)
    return handler(routeRequest.request, context ?? routeRequest.context)
}

function toRouteTestRequest<TParams extends RouteParamsConstraint<TParams>>(
    input: Request | RequestBuilder<TParams> | RouteTestRequest<TParams>,
): RouteTestRequest<TParams> {
    if (input instanceof RequestBuilder) {
        return input.buildRouteRequest()
    }

    if (isRouteTestRequest(input)) {
        return input
    }

    return {
        request: input,
        context: {
            params: Promise.resolve({} as TParams),
        },
    }
}

function appendQueryValue(searchParams: URLSearchParams, name: string, value: QueryValue | readonly QueryValue[]): void {
    searchParams.delete(name)

    if (Array.isArray(value)) {
        for (const item of value) {
            searchParams.append(name, String(item))
        }
        return
    }

    searchParams.set(name, String(value))
}

function snapshotParams<TParams extends RouteParamsConstraint<TParams>>(params: TParams): TParams {
    return Object.freeze(
        Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze([...value]) : value])),
    ) as TParams
}

function isRouteTestRequest<TParams extends RouteParamsConstraint<TParams>>(input: unknown): input is RouteTestRequest<TParams> {
    return typeof input === 'object' && input !== null && 'request' in input && 'context' in input
}
