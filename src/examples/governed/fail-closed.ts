import {
  type EvidenceRef,
  type GovernedActionDraftInput,
  createGovernedActionDraft,
  defineEntity,
} from '@veritio/core'

/**
 * Proves that `createGovernedActionDraft` fails closed: a governed mutation
 * either produces a complete, attributable draft or throws before any evidence
 * exists. Each case below removes exactly one required guarantee from an
 * otherwise valid draft input and prints the thrown error verbatim, so the
 * documented guard messages stay pinned to real 0.4.7 behavior. Every id,
 * timestamp, and key is fixed, keeping the output byte-stable for CI.
 */

type BillingPlanRow = {
  id: string
  planTier: string
  seatLimit: string
}

const billingPlan = defineEntity<BillingPlanRow>({
  authority: 'acme.example',
  type: 'billing_plan',
  schemaRef: 'acme.billing_plan.v1',
  fieldSetRef: 'acme.billing_plan.governed.v1',
  identity: (row) => row.id,
  fields: {
    planTier: { capture: 'full' },
    seatLimit: { capture: 'content_digest' },
  },
})

const owner: EvidenceRef = {
  authority: 'acme.example',
  kind: 'principal',
  type: 'user',
  id: 'usr_owner',
}

const producer: EvidenceRef = {
  authority: 'acme.example',
  kind: 'principal',
  type: 'service',
  id: 'svc_billing_api',
}

const currentPlan: BillingPlanRow = {
  id: 'plan_9001',
  planTier: 'team',
  seatLimit: '25',
}

/**
 * Returns the fully valid governed-action input used as the control. Each guard
 * case starts from this object and breaks a single required guarantee, so a
 * thrown error can only be attributed to that one removed guarantee.
 */
function validInput(): GovernedActionDraftInput<BillingPlanRow> {
  return {
    scope: { tenantId: 'org_acme', environment: 'production' },
    entity: billingPlan,
    before: currentPlan,
    after: { ...currentPlan, planTier: 'enterprise' },
    actionType: 'billing.plan.upgraded',
    activityType: 'billing.plan.upgrade',
    initiatedBy: owner,
    performedBy: owner,
    producer,
    occurredAt: '2026-08-09T10:00:00.000Z',
    idempotencyKey: 'billing:plan_9001:upgrade:1',
  }
}

/**
 * Applies one mutation to the control input and reports whether the draft
 * builder threw. Reporting `thrown: false` instead of silently passing keeps an
 * unenforced guard visible in the expected output rather than hidden.
 */
function guardResult(
  guard: string,
  mutate: (input: GovernedActionDraftInput<BillingPlanRow>) => GovernedActionDraftInput<BillingPlanRow>,
): Record<string, unknown> {
  try {
    createGovernedActionDraft(mutate(validInput()))
    return { guard, thrown: false }
  } catch (error) {
    const failure = error as Error
    return { guard, thrown: true, errorName: failure.name, message: failure.message }
  }
}

const control = createGovernedActionDraft(validInput())

const guards = [
  guardResult('missing tenant scope', (input) => ({
    ...input,
    scope: { environment: 'production' } as GovernedActionDraftInput<BillingPlanRow>['scope'],
  })),
  guardResult('empty idempotencyKey', (input) => ({ ...input, idempotencyKey: '   ' })),
  guardResult('principal ref missing authority', (input) => ({
    ...input,
    initiatedBy: { kind: 'principal', type: 'user', id: 'usr_owner' } as unknown as EvidenceRef,
  })),
  guardResult('principal ref missing id', (input) => ({
    ...input,
    performedBy: { ...owner, id: '' },
  })),
  guardResult('producer ref is not a principal', (input) => ({
    ...input,
    producer: { ...producer, kind: 'entity' },
  })),
  guardResult('no governed field changed', (input) => ({
    ...input,
    after: { ...currentPlan },
  })),
]

console.log(
  JSON.stringify(
    {
      control: {
        changeId: control.changeRef.id,
        activityId: control.activityRef.id,
        revisionId: control.revision.ref.id,
        changedPaths: control.revision.changedPaths,
        eventActions: control.events.map((event) => event.action),
      },
      guards,
      allGuardsFailClosed: guards.every((guard) => guard.thrown === true),
    },
    null,
    2,
  ),
)
