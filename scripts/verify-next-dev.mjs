import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const production = process.argv.includes('--production')
const fixtures = [
    {
        name: 'Next.js 15',
        packageName: '@next-route-kit/fixture-next15',
        port: 3215,
    },
    {
        name: 'Next.js 16',
        packageName: '@next-route-kit/fixture-next16',
        port: 3216,
    },
]

async function verifyFixture(fixture) {
    const nextCommand = production ? ['start'] : ['dev', '--turbopack']
    const child = spawn('pnpm', ['--filter', fixture.packageName, 'exec', 'next', ...nextCommand, '-p', String(fixture.port)], {
        cwd: rootDirectory,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    let logs = ''
    const appendLogs = (chunk) => {
        logs = `${logs}${chunk.toString()}`.slice(-6000)
    }

    child.stdout?.on('data', appendLogs)
    child.stderr?.on('data', appendLogs)

    try {
        await waitForRoute(child, `http://127.0.0.1:${fixture.port}/api/node?mode=dev`)
        await assertJson(`http://127.0.0.1:${fixture.port}/api/node?mode=dev`, { data: { runtime: 'nodejs' } }, { headers: { 'x-request-id': 'dev-node' } })
        await assertJson(`http://127.0.0.1:${fixture.port}/api/edge?mode=dev`, { data: { runtime: 'edge' } }, { headers: { 'x-request-id': 'dev-edge' } })
        await assertJson(`http://127.0.0.1:${fixture.port}/api/params/42`, { data: { id: '42' } }, { headers: { 'x-request-id': 'dev-params' } })
        await assertJson(
            `http://127.0.0.1:${fixture.port}/api/echo`,
            { data: { echo: 'dev' } },
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-request-id': 'dev-echo' },
                body: JSON.stringify({ message: 'dev' }),
            },
        )
        await assertJson(
            `http://127.0.0.1:${fixture.port}/api/accounts/acct-7/orders?preview=true`,
            { code: 'UNAUTHORIZED', requestId: 'dev-anonymous' },
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-request-id': 'dev-anonymous' },
                body: 'not-json',
            },
            401,
        )
        await assertJson(
            `http://127.0.0.1:${fixture.port}/api/accounts/acct-7/orders?preview=true`,
            {
                data: {
                    orderId: 'order-fixture-user-sku-42',
                    accountId: 'acct-7',
                    sku: 'sku-42',
                    quantity: 2,
                    preview: 'true',
                },
            },
            {
                method: 'POST',
                headers: {
                    authorization: 'Bearer fixture-token',
                    'content-type': 'application/json',
                    'x-request-id': 'dev-order',
                },
                body: JSON.stringify({ sku: 'sku-42', quantity: 2 }),
            },
        )
        console.log(`${fixture.name} ${production ? 'production' : 'Turbopack development'} smoke test passed.`)
    } catch (error) {
        throw new Error(`${fixture.name} Turbopack development smoke test failed.\n${logs}`, { cause: error })
    } finally {
        await stop(child)
    }
}

async function waitForRoute(child, url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (child.exitCode !== null) {
            throw new Error(`development server exited with code ${child.exitCode}`)
        }

        try {
            const response = await fetch(url)
            if (response.ok) {
                return
            }
        } catch {
            // The development server is still starting.
        }

        await delay(500)
    }

    throw new Error(`timed out waiting for ${url}`)
}

async function assertJson(url, expected, init, expectedStatus = 200) {
    const response = await fetch(url, init)
    if (response.status !== expectedStatus) {
        throw new Error(`${url} returned HTTP ${response.status}, expected ${expectedStatus}`)
    }

    const payload = await response.json()
    assertObjectContains(payload, expected, url)
}

function assertObjectContains(actual, expected, path) {
    for (const [key, value] of Object.entries(expected)) {
        const actualValue = actual?.[key]

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            assertObjectContains(actualValue, value, `${path}.${key}`)
            continue
        }

        if (actualValue !== value) {
            throw new Error(`${path} returned ${JSON.stringify(actual)}, expected ${key}=${JSON.stringify(value)}`)
        }
    }
}

async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return
    }

    try {
        if (child.pid !== undefined) {
            process.kill(-child.pid, 'SIGTERM')
        } else {
            child.kill('SIGTERM')
        }
    } catch {
        child.kill('SIGTERM')
    }

    await Promise.race([once(child, 'close'), delay(2000)])

    if (child.exitCode === null && child.signalCode === null) {
        try {
            if (child.pid !== undefined) {
                process.kill(-child.pid, 'SIGKILL')
            } else {
                child.kill('SIGKILL')
            }
        } catch {
            child.kill('SIGKILL')
        }
    }
}

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

for (const fixture of fixtures) {
    await verifyFixture(fixture)
}

console.log(`Verified ${fixtures.length} Next.js ${production ? 'production' : 'Turbopack development'} fixtures.`)
