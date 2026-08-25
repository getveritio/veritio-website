import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import catalog from '../src/data/cloud-billing-catalog.json'

type PublicCatalog = typeof catalog

/** Parses one non-secret public catalog artifact for exact reviewed comparison. */
function readCatalog(path: string): PublicCatalog {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as PublicCatalog
}

/** Fails closed when the checked-in or supplied Cloud export differs from the rendered copy. */
function verifyBillingCatalog(sourcePath: string): void {
  const source = readCatalog(sourcePath)
  if (JSON.stringify(source) !== JSON.stringify(catalog)) {
    throw new Error('Billing catalog source does not match the reviewed website snapshot.')
  }

  process.stdout.write(`billing catalog verified: ${catalog.version}\n`)
}

const sourceFlag = Bun.argv.indexOf('--source')
if (sourceFlag !== -1 && !Bun.argv[sourceFlag + 1]) {
  throw new Error('--source requires a JSON artifact path.')
}

const checkedInSource = join(import.meta.dir, '../src/data/cloud-billing-catalog.source.json')
verifyBillingCatalog(
  sourceFlag === -1
    ? (process.env.VERITIO_CLOUD_CATALOG_SOURCE ?? checkedInSource)
    : Bun.argv[sourceFlag + 1],
)
