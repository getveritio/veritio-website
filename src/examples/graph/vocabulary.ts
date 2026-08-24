import {
  EVIDENCE_EDGE_RELATIONS,
  EVIDENCE_ENTITY_TYPES,
  type EvidenceEdge,
  type EvidenceEdgeRelation,
  type EvidenceEntityType,
  createEvidenceEdge,
} from '@veritio/core'

/**
 * Prints the complete evidence-graph vocabularies shipped by `@veritio/core`
 * 0.4.7 and proves that they are CLOSED, not advisory.
 *
 * The invariant: `EVIDENCE_ENTITY_TYPES` and `EVIDENCE_EDGE_RELATIONS` are the
 * only entity types and relations the protocol recognises, and
 * `createEvidenceEdge` refuses membership in the graph to anything outside
 * them. A host application cannot invent a private relation ("promoted_by") or
 * a private entity type ("invoice") and still get an edge back — the guard
 * throws a `TypeError` before any edge object exists, so a reader of the graph
 * never has to interpret a vocabulary it does not know.
 *
 * This fixture is the source of truth for the vocabulary reference page, so it
 * prints the FULL lists verbatim in declaration order (that order is protocol
 * documentation, not presentation) together with their counts. A vocabulary
 * addition or removal in a future release shows up as a byte diff here rather
 * than as a silently stale docs page.
 *
 * It also pins the guard ORDER: `createEvidenceEdge` validates `from` and `to`
 * against the entity vocabulary BEFORE it validates `relation`, so an edge that
 * is wrong in both places reports the entity error first.
 *
 * The accepted edge's `id` and `occurredAt` are supplied literally — omitting
 * them would make `createEvidenceEdge` mint a random UUID and stamp the current
 * clock — so the printed output is byte-stable across runs.
 */

const scope = { tenantId: 'org_acme', environment: 'production' } as const

/**
 * Vocabulary terms a host application might plausibly want but that the
 * protocol does not define. They are typed as `string` on purpose: the compiler
 * already rejects them as literals, and widening first is what makes the
 * downstream assertion legal so the fixture can reach — and prove — the runtime
 * guard.
 */
const UNKNOWN_RELATION: string = 'promoted_by'
const UNKNOWN_ENTITY_TYPE: string = 'invoice'

/**
 * Builds the one accepted edge shown next to the rejections: a `pull_request`
 * that `reviewed_by` a `principal`. Both endpoint types and the relation are
 * drawn from the printed vocabularies, which is exactly why it is accepted.
 */
function buildAcceptedEdge(): EvidenceEdge {
  return createEvidenceEdge({
    id: 'edge_pr_reviewed_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    scope,
    from: { type: 'pull_request', id: 'pr_4821' },
    relation: 'reviewed_by',
    to: { type: 'principal', id: 'usr_reviewer', actorType: 'user' },
    metadata: { reviewDecision: 'approved' },
  })
}

/**
 * One closed-vocabulary probe. `run` is lazy so the thrown `TypeError` is
 * caught by the runner below instead of aborting the fixture, and the caught
 * message is printed verbatim rather than paraphrased.
 */
interface VocabularyProbe {
  readonly name: string
  readonly run: () => EvidenceEdge
}

const probes: VocabularyProbe[] = [
  {
    name: 'relation outside EVIDENCE_EDGE_RELATIONS',
    run: () =>
      createEvidenceEdge({
        id: 'edge_rejected_relation_01',
        occurredAt: '2026-08-09T10:00:00.000Z',
        scope,
        from: { type: 'pull_request', id: 'pr_4821' },
        relation: UNKNOWN_RELATION as EvidenceEdgeRelation,
        to: { type: 'principal', id: 'usr_reviewer', actorType: 'user' },
      }),
  },
  {
    name: 'entity type outside EVIDENCE_ENTITY_TYPES',
    run: () =>
      createEvidenceEdge({
        id: 'edge_rejected_entity_01',
        occurredAt: '2026-08-09T10:00:00.000Z',
        scope,
        from: { type: UNKNOWN_ENTITY_TYPE as EvidenceEntityType, id: 'inv_77' },
        relation: 'part_of',
        to: { type: 'activity', id: 'act_billing_run' },
      }),
  },
  {
    name: 'unknown entity type AND unknown relation',
    run: () =>
      createEvidenceEdge({
        id: 'edge_rejected_both_01',
        occurredAt: '2026-08-09T10:00:00.000Z',
        scope,
        from: { type: UNKNOWN_ENTITY_TYPE as EvidenceEntityType, id: 'inv_77' },
        relation: UNKNOWN_RELATION as EvidenceEdgeRelation,
        to: { type: 'activity', id: 'act_billing_run' },
      }),
  },
]

/**
 * Runs one probe and reports the guard outcome. A probe that does NOT throw is
 * reported as `accepted`, never skipped: a vocabulary guard that stops firing
 * is a protocol regression and must surface in the byte diff.
 */
function probeOutcome(probe: VocabularyProbe): Record<string, string> {
  try {
    const edge = probe.run()
    return { case: probe.name, outcome: 'accepted', edgeId: edge.id }
  } catch (error) {
    return {
      case: probe.name,
      outcome: 'rejected',
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

if (import.meta.main) {
  const output = {
    entityTypes: {
      count: EVIDENCE_ENTITY_TYPES.length,
      values: [...EVIDENCE_ENTITY_TYPES],
    },
    edgeRelations: {
      count: EVIDENCE_EDGE_RELATIONS.length,
      values: [...EVIDENCE_EDGE_RELATIONS],
    },
    acceptedEdge: buildAcceptedEdge(),
    closedVocabularyGuards: probes.map(probeOutcome),
  }

  console.log(JSON.stringify(output, null, 2))
}
