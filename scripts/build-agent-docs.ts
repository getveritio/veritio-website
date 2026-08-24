import { copyFileSync, globSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import TurndownService from 'turndown'
import YAML from 'yaml'

const root = join(import.meta.dir, '..')
const distRoot = join(root, 'dist')

/** Converts the rendered page body so imported fixtures and MDX components
 * become faithful, framework-neutral Markdown instead of source placeholders. */
function renderedPageToMarkdown(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  if (!main) throw new Error('Rendered page is missing a <main> content boundary.')

  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    headingStyle: 'atx',
  })
  turndown.remove((node) => ['button', 'nav', 'script', 'style', 'svg', 'template'].includes(node.nodeName.toLowerCase()))
  turndown.addRule('fenced-code-with-language', {
    filter: 'pre',
    replacement(_content, node) {
      const element = node as HTMLElement
      const language = element.getAttribute('data-language') || ''
      const renderedLines = Array.from(element.querySelectorAll('.ec-line')).map((line) => line.textContent || '')
      const code = (renderedLines.length > 0 ? renderedLines.join('\n') : element.textContent || '').trimEnd()
      return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`
    },
  })

  return `${turndown.turndown(main).replace(/\n{3,}/g, '\n\n').trim()}\n`
}

/** Maps a canonical HTML output to its static Markdown sibling route. */
function markdownOutputPath(htmlPath: string): string {
  const rel = relative(distRoot, htmlPath)
  if (basename(rel) !== 'index.html') return join(distRoot, rel.replace(/\.html$/, '.md'))
  const directory = dirname(rel)
  return directory === '.' ? join(distRoot, 'index.md') : join(distRoot, `${directory}.md`)
}

/** Emits one Markdown representation for every canonical public HTML page. */
for (const htmlPath of globSync(join(distRoot, '**/*.html'))) {
  const rel = relative(distRoot, htmlPath)
  if (rel === '404.html' || rel === 'docs/cloud-getting-started/index.html' || rel === 'docs/connect-agents/index.html') continue
  writeFileSync(markdownOutputPath(htmlPath), renderedPageToMarkdown(readFileSync(htmlPath, 'utf8')))
}

// This intentionally public registry contains approvals only; private evidence
// mappings stay outside the public website repository and build output.
copyFileSync(join(root, 'src/data/public-claims.json'), join(distRoot, 'claims.json'))

type AgentPage = {
  url: string
  markdownUrl: string
  title: string
  description: string
  group: string
  audience: string[]
  kind: string
  searchIntent: string
  questions: string[]
  lastUpdated: string
  verifiedAgainst: string[]
  sourceRefs: string[]
  claimRefs: string[]
}

/** Reads the build-validated docs frontmatter into a public discovery record. */
function agentPageFromSource(sourcePath: string): AgentPage {
  const source = readFileSync(sourcePath, 'utf8')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]
  if (!frontmatter) throw new Error(`Missing frontmatter in ${sourcePath}`)
  const data = YAML.parse(frontmatter) as Record<string, unknown>
  const relativePath = relative(join(root, 'src/content/docs/docs'), sourcePath)
  const withoutExtension = relativePath.slice(0, -extname(relativePath).length).replaceAll('\\', '/')
  const routePath = withoutExtension === 'index' ? '/docs/' : `/docs/${withoutExtension}/`
  const markdownPath = withoutExtension === 'index' ? '/docs.md' : `/docs/${withoutExtension}.md`

  return {
    url: new URL(routePath, 'https://getveritio.com').href,
    markdownUrl: new URL(markdownPath, 'https://getveritio.com').href,
    title: String(data.title),
    description: String(data.description),
    group: withoutExtension === 'index' ? 'start' : withoutExtension.split('/')[0],
    audience: data.audience as string[],
    kind: String(data.kind),
    searchIntent: String(data.searchIntent),
    questions: data.questions as string[],
    lastUpdated: data.lastUpdated instanceof Date
      ? data.lastUpdated.toISOString().slice(0, 10)
      : String(data.lastUpdated),
    verifiedAgainst: data.verifiedAgainst as string[],
    sourceRefs: data.sourceRefs as string[],
    claimRefs: data.claimRefs as string[],
  }
}

/** Emits a compact machine-readable catalog and a bounded full-text corpus. */
function writeAgentDiscoveryFiles(): void {
  const docsSourceRoot = join(root, 'src/content/docs/docs')
  const pages = globSync(join(docsSourceRoot, '**/*.{md,mdx}'))
    .map(agentPageFromSource)
    .sort((left, right) => left.url.localeCompare(right.url))

  writeFileSync(join(distRoot, 'agent-index.json'), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    canonicalSite: 'https://getveritio.com/',
    scope: 'English Veritio documentation. HTML pages are canonical; Markdown URLs are alternate representations.',
    pages,
  }, null, 2)}\n`)

  const sections = pages.map((page) => {
    const markdownPath = new URL(page.markdownUrl).pathname.replace(/^\//, '')
    const body = readFileSync(join(distRoot, markdownPath), 'utf8').replace(/^# .+\n+/, '')
    return [
      `## ${page.title}`,
      `Source: ${page.url}`,
      `Markdown: ${page.markdownUrl}`,
      `Verified against: ${page.verifiedAgainst.join('; ')}`,
      `Questions: ${page.questions.join(' | ')}`,
      '',
      body.trim(),
    ].join('\n')
  })
  const corpus = [
    '# Veritio documentation corpus',
    '',
    'Canonical source: https://getveritio.com/docs/',
    'This generated text mirrors the public English documentation. It is an alternate representation, not a search-ranking guarantee or a separate source of truth.',
    '',
    ...sections,
    '',
  ].join('\n')
  // Publication bound for the agent-readable corpus. This is a runaway guard, not
  // an external protocol limit: it exists so a documentation change cannot silently
  // publish an unbounded blob. Recalibrated from 512 kB when the documentation grew
  // from 32 largely prose pages to a fixture-backed set covering the whole SDK.
  if (corpus.length >= 1_048_576) throw new Error(`llms-full.txt exceeds the 1 MiB publication bound (${corpus.length} bytes).`)
  writeFileSync(join(distRoot, 'llms-full.txt'), corpus)
}

writeAgentDiscoveryFiles()
