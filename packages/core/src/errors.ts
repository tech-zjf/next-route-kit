export interface HttpErrorOptions {
    readonly status: number
    readonly code: string
    readonly message: string
    readonly details?: unknown
    readonly cause?: unknown
}

export class HttpError extends Error {
    readonly status: number
    readonly code: string
    readonly details: unknown

    constructor(options: HttpErrorOptions) {
        super(options.message, { cause: options.cause })
        this.name = 'HttpError'
        this.status = options.status
        this.code = options.code
        this.details = options.details
    }
}

export function unauthorized(message = 'Authentication is required'): HttpError {
    return new HttpError({
        status: 401,
        code: 'UNAUTHORIZED',
        message,
    })
}

export function forbidden(message = 'You do not have permission to access this resource'): HttpError {
    return new HttpError({
        status: 403,
        code: 'FORBIDDEN',
        message,
    })
}

export class MissingResponseSerializerError extends Error {
    constructor() {
        super('A ResponseSerializer is required when a handler does not return a Response')
        this.name = 'MissingResponseSerializerError'
    }
}

export class DuplicateResponseSerializerError extends Error {
    constructor(names: readonly string[]) {
        super(`Multiple response serializers were registered in one scope: ${names.join(', ')}`)
        this.name = 'DuplicateResponseSerializerError'
    }
}

export class DuplicateMiddlewareNextError extends Error {
    constructor(name: string) {
        super(`Route middleware "${name}" called next() more than once`)
        this.name = 'DuplicateMiddlewareNextError'
    }
}

export class RuntimeIncompatiblePluginError extends Error {
    readonly pluginName: string
    readonly pluginRuntime: string
    readonly routeRuntime: string

    constructor(pluginName: string, pluginRuntime: string, routeRuntime: string) {
        super(
            `Plugin "${pluginName}" supports runtime "${pluginRuntime}" but the Route Factory is configured for "${routeRuntime}". ` +
                'Use a compatible plugin or create a separate Factory for this runtime.',
        )
        this.name = 'RuntimeIncompatiblePluginError'
        this.pluginName = pluginName
        this.pluginRuntime = pluginRuntime
        this.routeRuntime = routeRuntime
    }
}
