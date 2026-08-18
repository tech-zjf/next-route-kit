import type { AnyRouteContext, ErrorMapper, InputMetadata, InputPipe } from '@next-route-kit/core'

export interface ZodSafeParseSuccess<TOutput> {
    readonly success: true
    readonly data: TOutput
}

export interface ZodSafeParseFailure {
    readonly success: false
    readonly error: {
        readonly issues: readonly unknown[]
    }
}

export type ZodSafeParseResult<TOutput> = ZodSafeParseSuccess<TOutput> | ZodSafeParseFailure

/** The small Zod contract used by the adapter; it keeps the public API stable across Zod minor releases. */
export interface ZodSchemaLike<TOutput = unknown> {
    readonly _output: TOutput
    safeParseAsync(value: unknown): Promise<ZodSafeParseResult<TOutput>>
}

export type ZodOutput<TSchema> = TSchema extends { readonly _output: infer TOutput } ? TOutput : unknown

export interface ZodValidationIssue {
    readonly code?: string
    readonly message: string
    readonly path: readonly PropertyKey[]
    readonly [key: string]: unknown
}

export class ZodValidationError extends Error {
    readonly issues: readonly ZodValidationIssue[]
    readonly input: unknown
    readonly metadata: InputMetadata

    constructor(error: unknown, input: unknown, metadata: InputMetadata) {
        super('Input validation failed', { cause: error })
        this.name = 'ZodValidationError'
        this.issues = normalizeIssues(error)
        this.input = input
        this.metadata = metadata
    }
}

export interface ZodPipeOptions {
    readonly name?: string
}

/** An Input Pipe that validates and transforms the resolved route input with a Zod schema. */
export class ZodInputPipe<TSchema extends ZodSchemaLike = ZodSchemaLike> implements InputPipe<unknown, ZodOutput<TSchema>, AnyRouteContext> {
    readonly name: string

    constructor(
        readonly schema: TSchema,
        options: ZodPipeOptions = {},
    ) {
        this.name = options.name ?? 'zod-validation'
    }

    async transform(value: unknown, metadata: InputMetadata): Promise<ZodOutput<TSchema>> {
        const result = await this.schema.safeParseAsync(value)

        if (result.success) {
            return result.data as ZodOutput<TSchema>
        }

        throw new ZodValidationError(result.error, value, metadata)
    }
}

export function zodPipe<TSchema extends ZodSchemaLike>(schema: TSchema, options?: ZodPipeOptions): ZodInputPipe<TSchema> {
    return new ZodInputPipe(schema, options)
}

export interface ZodErrorMapperOptions {
    readonly name?: string
    readonly status?: number
    readonly code?: string
    readonly message?: string
    readonly headers?: HeadersInit
}

/** Maps ZodValidationError into a stable JSON error response. */
export class ZodErrorMapper<TContext extends AnyRouteContext = AnyRouteContext> implements ErrorMapper<TContext> {
    readonly name: string
    private readonly status: number
    private readonly code: string
    private readonly message: string
    private readonly headers: HeadersInit | undefined

    constructor(options: ZodErrorMapperOptions = {}) {
        this.name = options.name ?? 'zod-error-mapper'
        this.status = options.status ?? 400
        this.code = options.code ?? 'VALIDATION_ERROR'
        this.message = options.message ?? 'Input validation failed'
        this.headers = options.headers
    }

    map(error: unknown, _context: TContext): Response | undefined {
        if (!(error instanceof ZodValidationError)) {
            return undefined
        }

        const init: ResponseInit = { status: this.status }

        if (this.headers !== undefined) {
            init.headers = this.headers
        }

        return Response.json(
            {
                code: this.code,
                message: this.message,
                issues: error.issues,
            },
            init,
        )
    }
}

export function zodErrorMapper<TContext extends AnyRouteContext = AnyRouteContext>(options?: ZodErrorMapperOptions): ZodErrorMapper<TContext> {
    return new ZodErrorMapper(options)
}

function normalizeIssues(error: unknown): readonly ZodValidationIssue[] {
    const issues = isRecord(error) && Array.isArray(error.issues) ? error.issues : []

    return Object.freeze(
        issues.map((issue) => {
            const record = isRecord(issue) ? issue : undefined
            const path = record && Array.isArray(record.path) ? record.path.filter(isPropertyKey) : []
            const message = record && typeof record.message === 'string' ? record.message : 'Invalid input'
            const code = record && typeof record.code === 'string' ? record.code : undefined

            return Object.freeze({
                ...(record ?? {}),
                ...(code ? { code } : {}),
                message,
                path: Object.freeze(path),
            })
        }),
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isPropertyKey(value: unknown): value is PropertyKey {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol'
}
