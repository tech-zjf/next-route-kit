export class ResponseAssertionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ResponseAssertionError'
    }
}

/** Cached response assertions that do not depend on Vitest, Jest, or another test runner. */
export class ResponseAssertions {
    private textPromise: Promise<string> | undefined
    private jsonPromise: Promise<unknown> | undefined

    constructor(readonly response: Response) {}

    toBeOk(): this {
        if (!this.response.ok) {
            throw new ResponseAssertionError(`Expected a successful response, received ${this.response.status}`)
        }

        return this
    }

    toHaveStatus(expected: number): this {
        if (this.response.status !== expected) {
            throw new ResponseAssertionError(`Expected status ${expected}, received ${this.response.status}`)
        }

        return this
    }

    toHaveHeader(name: string, expected: string | null): this {
        const actual = this.response.headers.get(name)

        if (actual !== expected) {
            throw new ResponseAssertionError(`Expected header ${name} to be ${String(expected)}, received ${String(actual)}`)
        }

        return this
    }

    async text(): Promise<string> {
        this.textPromise ??= this.response.text()
        return this.textPromise
    }

    async json<TValue = unknown>(): Promise<TValue> {
        this.jsonPromise ??= this.text().then((value) => JSON.parse(value) as unknown)
        return (await this.jsonPromise) as TValue
    }

    async toHaveText(expected: string): Promise<this> {
        const actual = await this.text()

        if (actual !== expected) {
            throw new ResponseAssertionError(`Expected response text ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
        }

        return this
    }

    async toHaveJson(expected: unknown): Promise<this> {
        const actual = await this.json()

        if (stableJson(actual) !== stableJson(expected)) {
            throw new ResponseAssertionError(`Expected response JSON ${stableJson(expected)}, received ${stableJson(actual)}`)
        }

        return this
    }
}

export function expectResponse(response: Response): ResponseAssertions {
    return new ResponseAssertions(response)
}

function stableJson(value: unknown): string {
    return JSON.stringify(normalizeJson(value))
}

function normalizeJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeJson)
    }

    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, normalizeJson(entry)]),
        )
    }

    return value
}
