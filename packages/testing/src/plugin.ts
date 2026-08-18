import type { RoutePlugin, RoutePluginContribution, RuntimeSupport } from 'next-route-kit'

export interface TestPluginOptions {
    readonly runtime?: RuntimeSupport
}

/** A deterministic plugin double that exposes installation count for assertions. */
export class TestPlugin implements RoutePlugin {
    readonly name: string
    readonly runtime?: RuntimeSupport
    private readonly contribution: RoutePluginContribution
    private _installCount = 0

    constructor(name: string, contribution: RoutePluginContribution = {}, options: TestPluginOptions = {}) {
        this.name = name

        if (options.runtime !== undefined) {
            this.runtime = options.runtime
        }

        this.contribution = contribution
    }

    get installCount(): number {
        return this._installCount
    }

    install(): RoutePluginContribution {
        this._installCount += 1
        return this.contribution
    }

    reset(): void {
        this._installCount = 0
    }
}

export function createTestPlugin(name: string, contribution: RoutePluginContribution = {}, options?: TestPluginOptions): TestPlugin {
    return new TestPlugin(name, contribution, options)
}
