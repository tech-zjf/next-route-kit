import { DuplicateResponseSerializerError } from './errors.js'
import type { ErrorMapper, Guard, InputPipe, Interceptor, ResponseSerializer, RouteMiddleware, RoutePlugin, RoutePluginContribution } from './types.js'

export interface RoutePluginContributionSnapshot {
    readonly middleware: readonly RouteMiddleware[]
    readonly guards: readonly Guard[]
    readonly inputPipes: readonly InputPipe[]
    readonly interceptors: readonly Interceptor[]
    readonly errorMappers: readonly ErrorMapper[]
    readonly responseSerializer: ResponseSerializer | undefined
}

/**
 * Owns plugin installation and contribution aggregation for one immutable
 * Factory/configuration scope.
 *
 * The registry deliberately has no process-global state. Constructing a child
 * registry installs only the plugins supplied to that child scope, which makes
 * plugin ownership explicit and keeps Factory derivation deterministic.
 */
export class RoutePluginRegistry {
    readonly plugins: readonly RoutePlugin[]
    readonly contributions: readonly RoutePluginContribution[]

    constructor(plugins: readonly RoutePlugin[] = []) {
        this.plugins = Object.freeze([...plugins])
        this.contributions = Object.freeze(this.plugins.map((plugin) => RoutePluginRegistry.freezeContribution(plugin.install())))
        Object.freeze(this)
    }

    /** Return a child registry without modifying this registry. */
    extend(plugins: readonly RoutePlugin[] = []): RoutePluginRegistry {
        if (plugins.length === 0) {
            return this
        }

        const child = new RoutePluginRegistry(plugins)
        return RoutePluginRegistry.fromInstalled([...this.plugins, ...child.plugins], [...this.contributions, ...child.contributions])
    }

    /** Aggregate contributions in explicit registration order. */
    snapshot(): RoutePluginContributionSnapshot {
        const responseSerializers = this.contributions
            .map((contribution) => contribution.responseSerializer)
            .filter((serializer): serializer is ResponseSerializer => Boolean(serializer))

        if (responseSerializers.length > 1) {
            throw new DuplicateResponseSerializerError(responseSerializers.map((serializer) => serializer.name))
        }

        return Object.freeze({
            middleware: this.freeze(this.contributions.flatMap((contribution) => contribution.middleware ?? [])),
            guards: this.freeze(this.contributions.flatMap((contribution) => contribution.guards ?? [])),
            inputPipes: this.freeze(this.contributions.flatMap((contribution) => contribution.inputPipes ?? [])),
            interceptors: this.freeze(this.contributions.flatMap((contribution) => contribution.interceptors ?? [])),
            errorMappers: this.freeze(this.contributions.flatMap((contribution) => contribution.errorMappers ?? [])),
            responseSerializer: responseSerializers[0],
        })
    }

    private freeze<T>(items: T[]): readonly T[] {
        return Object.freeze(items)
    }

    private static freezeContribution(contribution: RoutePluginContribution): RoutePluginContribution {
        return Object.freeze({
            ...contribution,
            ...(contribution.middleware ? { middleware: Object.freeze([...contribution.middleware]) } : {}),
            ...(contribution.guards ? { guards: Object.freeze([...contribution.guards]) } : {}),
            ...(contribution.inputPipes ? { inputPipes: Object.freeze([...contribution.inputPipes]) } : {}),
            ...(contribution.interceptors ? { interceptors: Object.freeze([...contribution.interceptors]) } : {}),
            ...(contribution.errorMappers ? { errorMappers: Object.freeze([...contribution.errorMappers]) } : {}),
        })
    }

    /**
     * Compose an immutable parent/child view without invoking inherited
     * plugin install hooks a second time.
     */
    private static fromInstalled(plugins: readonly RoutePlugin[], contributions: readonly RoutePluginContribution[]): RoutePluginRegistry {
        const registry = Object.create(RoutePluginRegistry.prototype) as RoutePluginRegistry

        Object.defineProperties(registry, {
            plugins: {
                configurable: false,
                enumerable: true,
                value: Object.freeze([...plugins]),
                writable: false,
            },
            contributions: {
                configurable: false,
                enumerable: true,
                value: Object.freeze(contributions.map((contribution) => RoutePluginRegistry.freezeContribution(contribution))),
                writable: false,
            },
        })

        return Object.freeze(registry) as RoutePluginRegistry
    }
}
