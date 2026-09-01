import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { execFile as execFileCallback } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureDirectory = join(rootDirectory, 'tests/fixtures/packed-consumer')
const execFile = promisify(execFileCallback)

async function run(command, args, cwd) {
    const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
    })

    const exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('close', resolve)
    })

    if (exitCode !== 0) {
        throw new Error(`${command} ${args.join(' ')} exited with code ${exitCode}`)
    }
}

async function findTarball(directory, packagePrefix, excludedPrefixes = []) {
    const entries = await readdir(directory)
    const tarball = entries.find(
        (entry) => entry.startsWith(packagePrefix) && !excludedPrefixes.some((excludedPrefix) => entry.startsWith(excludedPrefix)) && entry.endsWith('.tgz'),
    )

    if (!tarball) {
        throw new Error(`Could not find ${packagePrefix} tarball in ${directory}`)
    }

    return join(directory, tarball)
}

async function verifyPackageBoundary(name, tarball) {
    const { stdout } = await execFile('tar', ['-tzf', tarball])
    const files = stdout
        .split('\n')
        .map((file) => file.trim())
        .filter(Boolean)

    const unexpectedFiles = files.filter(
        (file) =>
            file !== 'package/' &&
            file !== 'package/package.json' &&
            file !== 'package/README.md' &&
            file !== 'package/CHANGELOG.md' &&
            file !== 'package/LICENSE' &&
            !file.startsWith('package/dist/'),
    )

    if (!files.some((file) => file.startsWith('package/dist/'))) {
        throw new Error(`${name} tarball does not contain a dist/ runtime or declaration tree`)
    }

    if (unexpectedFiles.length > 0) {
        throw new Error(`${name} tarball contains unexpected files: ${unexpectedFiles.join(', ')}`)
    }

    console.log(`${name} npm package boundary verified (${files.length} files).`)
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'next-route-kit-packed-consumer-'))
const artifactDirectory = join(temporaryDirectory, 'artifacts')
const consumerDirectory = join(temporaryDirectory, 'consumer')
let keepArtifacts = false
await mkdir(artifactDirectory)
await mkdir(consumerDirectory)

try {
    await run('pnpm', ['pack', '--pack-destination', artifactDirectory], join(rootDirectory, 'packages/core'))
    await run('pnpm', ['pack', '--pack-destination', artifactDirectory], join(rootDirectory, 'packages/next-route-kit'))
    await run('pnpm', ['pack', '--pack-destination', artifactDirectory], join(rootDirectory, 'packages/zod'))
    await run('pnpm', ['pack', '--pack-destination', artifactDirectory], join(rootDirectory, 'packages/testing'))
    await run('pnpm', ['pack', '--pack-destination', artifactDirectory], join(rootDirectory, 'packages/zod/node_modules/zod'))

    const coreTarball = await findTarball(artifactDirectory, 'next-route-kit-core-')
    const kitTarball = await findTarball(artifactDirectory, 'next-route-kit-', ['next-route-kit-core-', 'next-route-kit-zod-', 'next-route-kit-testing-'])
    const zodTarball = await findTarball(artifactDirectory, 'next-route-kit-zod-')
    const testingTarball = await findTarball(artifactDirectory, 'next-route-kit-testing-')
    const zodPeerTarball = await findTarball(artifactDirectory, 'zod-')

    await verifyPackageBoundary('@next-route-kit/core', coreTarball)
    await verifyPackageBoundary('next-route-kit', kitTarball)
    await verifyPackageBoundary('@next-route-kit/zod', zodTarball)
    await verifyPackageBoundary('@next-route-kit/testing', testingTarball)

    await cp(join(fixtureDirectory, 'src'), join(consumerDirectory, 'src'), { recursive: true })
    await cp(join(fixtureDirectory, 'tsconfig.json'), join(consumerDirectory, 'tsconfig.json'))
    await writeFile(
        join(consumerDirectory, 'pnpm-workspace.yaml'),
        `packages:\n  - .\noverrides:\n  '@next-route-kit/core': ${JSON.stringify(`file:${coreTarball}`)}\n  'next-route-kit': ${JSON.stringify(`file:${kitTarball}`)}\n`,
    )
    await writeFile(
        join(consumerDirectory, 'package.json'),
        `${JSON.stringify(
            {
                name: 'next-route-kit-packed-consumer',
                private: true,
                type: 'module',
                dependencies: {
                    'next-route-kit': `file:${kitTarball}`,
                    '@next-route-kit/zod': `file:${zodTarball}`,
                    '@next-route-kit/testing': `file:${testingTarball}`,
                    zod: `file:${zodPeerTarball}`,
                },
            },
            null,
            4,
        )}\n`,
    )

    console.log('Installing packed packages in an external temporary consumer...')
    await run('pnpm', ['install', '--ignore-scripts', '--offline', '--lockfile=false'], consumerDirectory)
    await run('pnpm', ['exec', 'tsc', '--project', join(consumerDirectory, 'tsconfig.json')], rootDirectory)
    await run('node', [join(consumerDirectory, 'dist/index.js')], consumerDirectory)

    const packageManifest = JSON.parse(await readFile(join(consumerDirectory, 'node_modules/next-route-kit/package.json'), 'utf8'))
    if (packageManifest.exports?.['.']?.import !== './dist/index.js' || packageManifest.types !== './dist/index.d.ts') {
        throw new Error('Packed package exports do not expose the expected runtime and type entrypoints')
    }

    const zodPackageManifest = JSON.parse(await readFile(join(consumerDirectory, 'node_modules/@next-route-kit/zod/package.json'), 'utf8'))
    if (zodPackageManifest.exports?.['.']?.import !== './dist/index.js' || zodPackageManifest.types !== './dist/index.d.ts') {
        throw new Error('Packed Zod adapter exports do not expose the expected runtime and type entrypoints')
    }

    const testingPackageManifest = JSON.parse(await readFile(join(consumerDirectory, 'node_modules/@next-route-kit/testing/package.json'), 'utf8'))
    if (testingPackageManifest.exports?.['.']?.import !== './dist/index.js' || testingPackageManifest.types !== './dist/index.d.ts') {
        throw new Error('Packed testing package exports do not expose the expected runtime and type entrypoints')
    }

    console.log('Packed external consumer verification passed.')
} catch (error) {
    console.error(`Packed consumer artifacts were kept at ${temporaryDirectory}`)
    keepArtifacts = true
    throw error
} finally {
    if (!keepArtifacts) {
        await rm(temporaryDirectory, { recursive: true, force: true })
    }
}
