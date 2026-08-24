import { verifyAuditRecords } from '@veritio/core'
import { recordTutorialChain } from './record-and-verify'

const records = await recordTutorialChain()
const changed = records.map((record, index) =>
  index === 1
    ? { ...record, event: { ...record.event, metadata: { ...record.event.metadata, role: 'admin' } } }
    : record,
)
const dropped = records.slice(1)

console.log(JSON.stringify({
  changedRecord: verifyAuditRecords(changed),
  droppedRecord: verifyAuditRecords(dropped),
}, null, 2))
