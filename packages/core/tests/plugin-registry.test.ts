import { describe, expect, it } from 'vitest'
import { DuplicateResponseSerializerError, RoutePluginRegistry } from '../src/index.js'

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
                                handle(_context, next) {
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
                                handle(_context, next) {
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
})
