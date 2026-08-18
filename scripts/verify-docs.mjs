import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['README.md', 'README.zh-CN.md', 'docs', 'packages']
const markdownFiles = []

for (const root of roots) {
    const absoluteRoot = join(rootDirectory, root)
    const rootStats = await stat(absoluteRoot)

    if (rootStats.isDirectory()) {
        await collectMarkdownFiles(absoluteRoot)
    } else if (extname(absoluteRoot) === '.md') {
        markdownFiles.push(absoluteRoot)
    }
}

const failures = []
const localLinkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

for (const file of markdownFiles) {
    const contents = await readFile(file, 'utf8')

    for (const match of contents.matchAll(localLinkPattern)) {
        const href = match[1]

        if (!href || href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) {
            continue
        }

        const target = resolve(dirname(file), decodeURIComponent(href.split('#')[0]))

        try {
            await stat(target)
        } catch {
            failures.push(`${relative(rootDirectory, file)} -> ${href}`)
        }
    }
}

const languageRoots = [join(rootDirectory, 'docs/en/user-guide'), join(rootDirectory, 'docs/zh-CN/user-guide')]
const englishPages = await readdir(languageRoots[0])
const englishPageSet = new Set(englishPages)
const chinesePages = new Set(await readdir(languageRoots[1]))

for (const page of englishPages) {
    if (extname(page) === '.md' && !chinesePages.has(page)) {
        failures.push(`docs/zh-CN/user-guide is missing ${page}`)
    }
}

for (const page of chinesePages) {
    if (extname(page) === '.md' && !englishPageSet.has(page)) {
        failures.push(`docs/en/user-guide is missing ${page}`)
    }
}

if (failures.length > 0) {
    throw new Error(`Documentation verification failed:\n${failures.join('\n')}`)
}

console.log(`Verified ${markdownFiles.length} Markdown files and ${englishPages.length} bilingual user-guide pages.`)

async function collectMarkdownFiles(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)

        if (entry.isDirectory()) {
            await collectMarkdownFiles(path)
        } else if (extname(entry.name) === '.md') {
            markdownFiles.push(path)
        }
    }
}
