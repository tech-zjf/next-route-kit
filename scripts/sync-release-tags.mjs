import { execFile as execFileCallback } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const packagesDirectory = join(rootDirectory, 'packages')
const verifyOnly = process.argv.includes('--verify-only')

const packages = await readPublishablePackages()
const releaseCommit = await git(['rev-parse', 'HEAD'])
const expectedTags = packages.map(({ name, version, manifestPath }) => ({
    name,
    version,
    manifestPath,
    tag: `${name}@${version}`,
}))

if (expectedTags.length === 0) {
    throw new Error('No publishable packages were found')
}

const tagsToPush = []
const tagsToVerify = []

for (const releaseTag of expectedTags) {
    const localCommit = await localTagCommit(releaseTag.tag)
    const remoteCommit = await remoteTagCommit(releaseTag.tag)

    if (remoteCommit !== null && remoteCommit !== releaseCommit) {
        if (await packageManifestChangedSince(remoteCommit, releaseTag.manifestPath, releaseCommit)) {
            throw new Error(
                `Remote tag ${releaseTag.tag} points to ${remoteCommit}, but the release commit is ${releaseCommit}. Refusing to overwrite the tag.`,
            )
        }

        console.log(`Release tag ${releaseTag.tag} belongs to an unchanged package; leaving it at ${remoteCommit}.`)
        continue
    }

    if (localCommit !== null && localCommit !== releaseCommit) {
        throw new Error(`Local tag ${releaseTag.tag} points to ${localCommit}, but the release commit is ${releaseCommit}. Refusing to overwrite the tag.`)
    }

    if (remoteCommit === releaseCommit) {
        console.log(`Release tag ${releaseTag.tag} is already synchronized.`)
        tagsToVerify.push(releaseTag)
        continue
    }

    if (verifyOnly) {
        throw new Error(`Release tag ${releaseTag.tag} is missing from origin`)
    }

    if (localCommit === null) {
        await git(['tag', '--annotate', releaseTag.tag, releaseCommit, '--message', releaseTag.tag])
        console.log(`Created release tag ${releaseTag.tag}.`)
    }

    tagsToPush.push(releaseTag.tag)
    tagsToVerify.push(releaseTag)
}

if (verifyOnly) {
    console.log(`Verified ${tagsToVerify.length} release tags for this commit; unchanged package tags were left intact.`)
    process.exit(0)
}

if (tagsToPush.length > 0) {
    const refs = tagsToPush.map((tag) => `refs/tags/${tag}:refs/tags/${tag}`)
    await git(['push', 'origin', ...refs])
    console.log(`Pushed ${tagsToPush.length} release tags.`)
}

for (const releaseTag of tagsToVerify) {
    const remoteCommit = await remoteTagCommit(releaseTag.tag)

    if (remoteCommit !== releaseCommit) {
        throw new Error(`Release tag ${releaseTag.tag} was not verified on origin after pushing`)
    }
}

console.log(`Synchronized ${tagsToVerify.length} release tags for ${releaseCommit}.`)

async function readPublishablePackages() {
    const entries = await readdir(packagesDirectory, { withFileTypes: true })
    const packageManifests = []

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue
        }

        const manifestPath = join(packagesDirectory, entry.name, 'package.json')

        try {
            const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

            if (manifest.private === true || manifest.publishConfig?.access !== 'public') {
                continue
            }

            if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
                throw new Error(`Package manifest ${manifestPath} must define a name and version`)
            }

            packageManifests.push({
                name: manifest.name,
                version: manifest.version,
                manifestPath: `packages/${entry.name}/package.json`,
            })
        } catch (error) {
            if (error?.code === 'ENOENT') {
                continue
            }

            throw error
        }
    }

    return packageManifests.sort((left, right) => left.name.localeCompare(right.name))
}

async function packageManifestChangedSince(commit, manifestPath, releaseCommit) {
    const changedFiles = await git(['diff', '--name-only', `${commit}..${releaseCommit}`, '--', manifestPath])
    return changedFiles.length > 0
}

async function localTagCommit(tag) {
    const result = await git(['rev-list', '--max-count=1', tag], { allowFailure: true })
    return result || null
}

async function remoteTagCommit(tag) {
    const output = await git(['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])

    if (!output) {
        return null
    }

    const refs = output
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter(([commit, ref]) => commit && ref)
    const peeledRef = refs.find(([, ref]) => ref === `refs/tags/${tag}^{}`)
    return peeledRef?.[0] ?? refs[0]?.[0] ?? null
}

async function git(args, options = {}) {
    try {
        const { stdout } = await execFile('git', args, { cwd: rootDirectory })
        return stdout.trim()
    } catch (error) {
        if (options.allowFailure) {
            return ''
        }

        const stderr = error.stderr?.trim()
        throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`, { cause: error })
    }
}
