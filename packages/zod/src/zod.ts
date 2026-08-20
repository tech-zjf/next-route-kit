import type { AnyRouteContext, ArgumentMetadata, ExceptionFilter, Pipe } from '@next-route-kit/core'

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
}

export interface ZodValidationErrorOptions {
    /** Retain the rejected value for debugging. Disabled by default because inputs may contain secrets. */
    readonly captureInput?: boolean
}

export class ZodValidationError extends Error {
    readonly issues: readonly ZodValidationIssue[]
    readonly input: unknown
    readonly metadata: ArgumentMetadata

    constructor(error: unknown, input: unknown, metadata: ArgumentMetadata, options: ZodValidationErrorOptions = {}) {
        super('Input validation failed', { cause: error })
        this.name = 'ZodValidationError'
        this.issues = normalizeIssues(error)
        this.input = options.captureInput ? input : undefined
        this.metadata = metadata
    }
}

export interface ZodPipeOptions {
    readonly name?: string
    /** Limit this pipe to one resolved argument, for example body or query. */
    readonly appliesTo?: ArgumentMetadata['type']
    /** Retain rejected input on ZodValidationError. Disabled by default because inputs may contain secrets. */
    readonly captureInput?: boolean
}

/** A Pipe that validates one resolved route argument with a Zod schema. */
export class ZodPipe<TSchema extends ZodSchemaLike = ZodSchemaLike> implements Pipe<unknown, ZodOutput<TSchema>, AnyRouteContext> {
    readonly name: string
    private readonly appliesTo: ArgumentMetadata['type'] | undefined
    private readonly captureInput: boolean

    constructor(
        readonly schema: TSchema,
        options: ZodPipeOptions = {},
    ) {
        this.name = options.name ?? 'zod-validation'
        this.appliesTo = options.appliesTo
        this.captureInput = options.captureInput ?? false
    }

    async transform(value: unknown, metadata: ArgumentMetadata): Promise<ZodOutput<TSchema>> {
        if (this.appliesTo !== undefined && metadata.type !== this.appliesTo) {
            return value as ZodOutput<TSchema>
        }

        const result = await this.schema.safeParseAsync(value)

        if (result.success) {
            return result.data as ZodOutput<TSchema>
        }

        throw new ZodValidationError(result.error, value, metadata, { captureInput: this.captureInput })
    }
}

export function zodPipe<TSchema extends ZodSchemaLike>(schema: TSchema, options?: ZodPipeOptions): ZodPipe<TSchema> {
    return new ZodPipe(schema, options)
}

export interface ZodExceptionFilterOptions {
    readonly name?: string
    readonly status?: number
    readonly code?: string
    readonly message?: string
    readonly headers?: HeadersInit
}

/** Maps ZodValidationError into this adapter's standalone JSON response. */
export class ZodExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext> implements ExceptionFilter<TContext> {
    readonly name: string
    private readonly status: number
    private readonly code: string
    private readonly message: string
    private readonly headers: HeadersInit | undefined

    constructor(options: ZodExceptionFilterOptions = {}) {
        this.name = options.name ?? 'zod-exception-filter'
        this.status = options.status ?? 400
        this.code = options.code ?? 'VALIDATION_ERROR'
        this.message = options.message ?? 'Input validation failed'
        this.headers = options.headers
    }

    catch(error: unknown, _context: TContext): Response | undefined {
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

export function zodExceptionFilter<TContext extends AnyRouteContext = AnyRouteContext>(options?: ZodExceptionFilterOptions): ZodExceptionFilter<TContext> {
    return new ZodExceptionFilter(options)
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
