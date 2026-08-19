import { DuplicateResponseSerializerError, RuntimeIncompatiblePluginError } from './errors.js'
import type {
    ExceptionFilter,
    Guard,
    Interceptor,
    Pipe,
    ResponseSerializer,
    RouteMiddleware,
    RoutePlugin,
    RoutePluginContribution,
    RouteRuntime,
    RuntimeSupport,
} from './types.js'

export interface RoutePluginContributionSnapshot {
    readonly middleware: readonly RouteMiddleware[]
    readonly guards: readonly Guard[]
    readonly pipes: readonly Pipe[]
    readonly interceptors: readonly Interceptor[]
    readonly exceptionFilters: readonly ExceptionFilter[]
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

    constructor(plugins: readonly RoutePlugin[] = [], runtime?: RouteRuntime) {
        this.plugins = Object.freeze([...plugins])
        this.validateRuntime(runtime)
        this.contributions = Object.freeze(this.plugins.map((plugin) => RoutePluginRegistry.freezeContribution(plugin.install())))
        Object.freeze(this)
    }

    /** Return a child registry without modifying this registry. */
    extend(plugins: readonly RoutePlugin[] = [], runtime?: RouteRuntime): RoutePluginRegistry {
        if (plugins.length === 0) {
            return this
        }

        return this.compose(new RoutePluginRegistry(plugins, runtime))
    }

    /** Compose a child registry whose plugin contributions have already been installed. */
    compose(child: RoutePluginRegistry): RoutePluginRegistry {
        if (child.plugins.length === 0) {
            return this
        }

        return RoutePluginRegistry.fromInstalled([...this.plugins, ...child.plugins], [...this.contributions, ...child.contributions])
    }

    /** Aggregate contributions in explicit registration order. */
    snapshot(runtime?: RouteRuntime): RoutePluginContributionSnapshot {
        this.validateRuntime(runtime)

        const responseSerializers = this.contributions
            .map((contribution) => contribution.responseSerializer)
            .filter((serializer): serializer is ResponseSerializer => Boolean(serializer))

        if (responseSerializers.length > 1) {
            throw new DuplicateResponseSerializerError(responseSerializers.map((serializer) => serializer.name))
        }

        return Object.freeze({
            middleware: this.freeze(this.contributions.flatMap((contribution) => contribution.middleware ?? [])),
            guards: this.freeze(this.contributions.flatMap((contribution) => contribution.guards ?? [])),
            pipes: this.freeze(this.contributions.flatMap((contribution) => contribution.pipes ?? [])),
            interceptors: this.freeze(this.contributions.flatMap((contribution) => contribution.interceptors ?? [])),
            exceptionFilters: this.freeze(this.contributions.flatMap((contribution) => contribution.exceptionFilters ?? [])),
            responseSerializer: responseSerializers[0],
        })
    }

    /** Fail early when a statically declared plugin cannot run in the target runtime. */
    validateRuntime(runtime?: RouteRuntime): void {
        if (runtime === undefined) {
            return
        }

        for (const plugin of this.plugins) {
            if (supportsRuntime(plugin.runtime, runtime)) {
                continue
            }

            throw new RuntimeIncompatiblePluginError(plugin.name, plugin.runtime as string, runtime)
        }
    }

    private freeze<T>(items: T[]): readonly T[] {
        return Object.freeze(items)
    }

    private static freezeContribution(contribution: RoutePluginContribution): RoutePluginContribution {
        return Object.freeze({
            ...contribution,
            ...(contribution.middleware ? { middleware: Object.freeze([...contribution.middleware]) } : {}),
            ...(contribution.guards ? { guards: Object.freeze([...contribution.guards]) } : {}),
            ...(contribution.pipes ? { pipes: Object.freeze([...contribution.pipes]) } : {}),
            ...(contribution.interceptors ? { interceptors: Object.freeze([...contribution.interceptors]) } : {}),
            ...(contribution.exceptionFilters ? { exceptionFilters: Object.freeze([...contribution.exceptionFilters]) } : {}),
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

function supportsRuntime(support: RuntimeSupport | undefined, runtime: RouteRuntime): boolean {
    return support === undefined || support === 'both' || support === runtime
}
