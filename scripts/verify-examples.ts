import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const root = join(import.meta.dir, '..')

/** Resolves the OSS checkout from both a normal clone and a nested worktree. */
function resolveOssRoot(): string {
  if (process.env.VERITIO_OSS_ROOT) return resolve(process.env.VERITIO_OSS_ROOT)

  let current = resolve(root)
  while (dirname(current) !== current) {
    if (basename(current) === 'veritio-website') {
      const candidate = join(dirname(current), 'veritio')
      if (existsSync(join(candidate, '.git'))) return candidate
      break
    }
    current = dirname(current)
  }

  throw new Error('Could not resolve the Veritio OSS checkout. Set VERITIO_OSS_ROOT explicitly.')
}

const sibling = resolveOssRoot()
const manifestPath = resolve(root, process.env.VERITIO_EXAMPLE_MANIFEST ?? 'src/examples/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  upstreamRevision: string
  examples: Array<{
    id: string
    language: 'typescript' | 'python' | 'go'
    path: string
    upstreamPath: string
    sha256: string
    command: string[]
    expectedOutputPath: string
  }>
}
const upstreamRevision = manifest.upstreamRevision

/**
 * Runs a verification subprocess and surfaces its complete output on failure.
 *
 * Colour is pinned off for every child. `bun run` exports FORCE_COLOR=1 when it
 * is attached to a terminal, which makes Bun's object inspector emit ANSI escape
 * sequences into piped stdout. The expected-output fixtures are compared byte
 * for byte, so an inherited FORCE_COLOR would fail the gate locally while it
 * still passed in CI. Do not forward the caller's colour environment.
 */
function run(command: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  const result = Bun.spawnSync(command, {
    cwd: options.cwd ?? root,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed\n${result.stdout.toString()}${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

/** Proves each fixture is unchanged from its reviewed content hash. */
for (const example of manifest.examples) {
  const source = readFileSync(join(root, example.path))
  const actual = createHash('sha256').update(source).digest('hex')
  if (example.sha256 !== actual) {
    throw new Error(`${example.path} hash changed: expected ${example.sha256}, received ${actual}`)
  }

  run(['git', 'cat-file', '-e', `${upstreamRevision}:${example.upstreamPath}`], { cwd: sibling })
}

run(['git', 'cat-file', '-e', `${upstreamRevision}^{commit}`], { cwd: sibling })

run(['bun', 'x', 'tsc', '--noEmit', '-p', 'tsconfig.examples.json'])

const upstreamTemp = mkdtempSync(join(tmpdir(), 'veritio-docs-upstream-'))
run(['git', 'archive', '--format=tar', '--output', join(upstreamTemp, 'sdk.tar'), upstreamRevision, 'sdks/python', 'sdks/go'], { cwd: sibling })
run(['tar', '-xf', join(upstreamTemp, 'sdk.tar'), '-C', upstreamTemp])
const goTemp = mkdtempSync(join(tmpdir(), 'veritio-docs-go-'))
try {
  writeFileSync(
    join(goTemp, 'go.mod'),
    `module veritio-doc-example\n\ngo 1.22\n\nrequire github.com/getveritio/veritio/sdks/go v0.0.0\nreplace github.com/getveritio/veritio/sdks/go => ${join(upstreamTemp, 'sdks/go')}\n`,
  )
  const outputs = new Map<string, string>()

  for (const example of manifest.examples) {
    let output: string
    if (example.language === 'python') {
      run(['python3', '-m', 'py_compile', example.path])
      output = run(example.command, { env: { PYTHONPATH: join(upstreamTemp, 'sdks/python/src') } })
    } else if (example.language === 'go') {
      const gofmt = run(['gofmt', '-d', example.path])
      if (gofmt.length > 0) throw new Error(`${example.path} is not formatted:\n${gofmt}`)
      writeFileSync(join(goTemp, 'main.go'), readFileSync(join(root, example.path)))
      run(['go', 'test', './...'], { cwd: goTemp })
      output = run(example.command, { cwd: goTemp })
    } else {
      output = run(example.command)
    }

    const normalizedOutput = output.replace(/\r\n/g, '\n')
    const expectedOutput = readFileSync(join(root, example.expectedOutputPath), 'utf8').replace(/\r\n/g, '\n')
    if (normalizedOutput !== expectedOutput) {
      throw new Error(`${example.id} output changed.\nExpected:\n${expectedOutput}\nReceived:\n${normalizedOutput}`)
    }
    outputs.set(example.id, normalizedOutput)
  }

  const quickstartIds = ['quickstart-typescript', 'quickstart-python', 'quickstart-go']
  if (quickstartIds.every((id) => outputs.has(id))) {
    const hashPrefixes = quickstartIds.map((id) => outputs.get(id)?.match(/[0-9a-f]{12}/)?.[0])
    if (hashPrefixes.some((hash) => !hash) || new Set(hashPrefixes).size !== 1) {
      throw new Error(`Cross-language event hashes diverged: ${hashPrefixes.join(', ')}`)
    }
  }
} finally {
  rmSync(goTemp, { recursive: true, force: true })
  rmSync(upstreamTemp, { recursive: true, force: true })
}

console.log('Verified TypeScript, Python, and Go documentation fixtures.')
