import { describe, expect, it } from 'vitest'
import { DuplicateResponseSerializerError, RoutePluginRegistry, RuntimeIncompatiblePluginError } from '../src/index.js'

describe('RoutePluginRegistry', () => {
    it('installs plugins once and aggregates contributions in registration order', () => {
        let installCount = 0

        const registry = new RoutePluginRegistry([
            {
                name: 'first',
                install() {
                    installCount += 1
                    return {
                        middleware: [
                            {
                                name: 'first-middleware',
                                use(_context, next) {
                                    return next()
                                },
                            },
                        ],
                    }
                },
            },
            {
                name: 'second',
                install() {
                    installCount += 1
                    return {
                        middleware: [
                            {
                                name: 'second-middleware',
                                use(_context, next) {
                                    return next()
                                },
                            },
                        ],
                    }
                },
            },
        ])

        expect(installCount).toBe(2)
        expect(Object.isFrozen(registry)).toBe(true)
        const snapshot = registry.snapshot()

        expect(Object.isFrozen(snapshot)).toBe(true)
        expect(snapshot.middleware.map((item) => item.name)).toEqual(['first-middleware', 'second-middleware'])
        expect(Object.isFrozen(registry.contributions)).toBe(true)
        expect(Object.isFrozen(registry.contributions[0]?.middleware)).toBe(true)
    })

    it('derives an immutable child registry', () => {
        let parentInstallCount = 0
        let childInstallCount = 0

        const parent = new RoutePluginRegistry([
            {
                name: 'parent',
                install() {
                    parentInstallCount += 1
                    return {}
                },
            },
        ])
        const child = parent.extend([
            {
                name: 'child',
                install() {
                    childInstallCount += 1
                    return {}
                },
            },
        ])

        expect(parent.plugins.map((plugin) => plugin.name)).toEqual(['parent'])
        expect(child.plugins.map((plugin) => plugin.name)).toEqual(['parent', 'child'])
        expect(parentInstallCount).toBe(1)
        expect(childInstallCount).toBe(1)
        expect(Object.isFrozen(child)).toBe(true)
    })

    it('returns the same registry when no child plugins are supplied', () => {
        const registry = new RoutePluginRegistry()

        expect(registry.extend()).toBe(registry)
    })

    it('composes an installed child registry without reinstalling its plugins', () => {
        let installCount = 0
        const parent = new RoutePluginRegistry()
        const child = new RoutePluginRegistry([
            {
                name: 'child',
                install() {
                    installCount += 1
                    return {}
                },
            },
        ])

        const composed = parent.compose(child)

        expect(installCount).toBe(1)
        expect(composed.plugins.map((plugin) => plugin.name)).toEqual(['child'])
    })

    it('rejects multiple response serializers in one plugin scope', () => {
        const registry = new RoutePluginRegistry([
            {
                name: 'first-response',
                install() {
                    return {
                        responseSerializer: {
                            name: 'first',
                            serialize: (value) => Response.json(value),
                        },
                    }
                },
            },
            {
                name: 'second-response',
                install() {
                    return {
                        responseSerializer: {
                            name: 'second',
                            serialize: (value) => Response.json(value),
                        },
                    }
                },
            },
        ])

        expect(() => registry.snapshot()).toThrow(DuplicateResponseSerializerError)
        expect(() => registry.snapshot()).toThrow('first, second')
    })

    it('rejects plugins that do not support the configured runtime', () => {
        const registry = new RoutePluginRegistry([
            {
                name: 'node-database',
                runtime: 'nodejs',
                install() {
                    return {}
                },
            },
            {
                name: 'portable-tracing',
                runtime: 'both',
                install() {
                    return {}
                },
            },
        ])

        expect(() => registry.snapshot('edge')).toThrow(RuntimeIncompatiblePluginError)
        expect(() => registry.snapshot('edge')).toThrow('node-database')
        expect(() => registry.snapshot('nodejs')).not.toThrow()
    })

    it('checks runtime compatibility before installing an incompatible plugin', () => {
        let installCount = 0

        expect(
            () =>
                new RoutePluginRegistry(
                    [
                        {
                            name: 'node-only',
                            runtime: 'nodejs',
                            install() {
                                installCount += 1
                                return {}
                            },
                        },
                    ],
                    'edge',
                ),
        ).toThrow(RuntimeIncompatiblePluginError)

        expect(installCount).toBe(0)
    })

    it('exposes renamed plugin stages in the snapshot', () => {
        const snapshot = new RoutePluginRegistry([
            {
                name: 'stages',
                install() {
                    return {
                        pipes: [{ name: 'pipe', transform: (value) => value }],
                        exceptionFilters: [{ name: 'filter', catch: () => undefined }],
                    }
                },
            },
        ]).snapshot()

        expect(snapshot.pipes.map((item) => item.name)).toEqual(['pipe'])
        expect(snapshot.exceptionFilters.map((item) => item.name)).toEqual(['filter'])
    })
})
