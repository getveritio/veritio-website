/**
 * Data for /alternatives/* comparison pages. Rules (see CLAUDE.md):
 * honest, approach-level comparisons only — concede what the other tool does
 * well, date the review, never claim compliance outcomes, and only state
 * Veritio behavior that exists in the OSS repo or the hosted console.
 */
export interface Alternative {
  slug: string
  name: string
  /** Search-facing H1, e.g. "An open-source alternative to X" */
  heading: string
  metaTitle: string
  metaDescription: string
  /** One-paragraph fair summary of what the other tool is. */
  what: string
  /** What the other tool is genuinely good at — concede plainly. */
  strengths: string[]
  /** Where Veritio's approach differs — concrete, verifiable. */
  differences: string[]
  /** Honest guidance: when the other tool is the better choice. */
  chooseThem: string
  /** When Veritio fits better. */
  chooseUs: string
  table: { dimension: string; them: string; veritio: string }[]
}

export const lastReviewed = 'July 2026'

export const alternatives: Alternative[] = [
  {
    slug: 'aws-cloudtrail',
    name: 'AWS CloudTrail',
    heading: 'An application-level alternative to AWS CloudTrail',
    metaTitle: 'AWS CloudTrail alternative for application evidence — Veritio',
    metaDescription:
      'CloudTrail records AWS control-plane activity. Veritio records application, agent, and deployment events as hash-linked, independently verifiable evidence — self-hosted or managed.',
    what: 'CloudTrail is AWS’s native audit service. It records management and API activity across AWS accounts — who called which AWS API, from where, with what result — and delivers logs to S3 or CloudTrail Lake for retention and query.',
    strengths: [
      'Unmatched coverage of AWS control-plane activity, enabled by default for management events.',
      'Organization trails aggregate accounts with no application changes.',
      'Log file integrity validation with signed digest files.',
      'Deep AWS ecosystem integration: S3, Athena, EventBridge, CloudTrail Lake.',
    ],
    differences: [
      'Veritio records what your product and your agents did — application events, AI agent sessions, code changes, deployments, approvals — not AWS API calls. The two are complementary layers.',
      'Records are hash-linked at the application level and export to an open bundle format that a third party can verify with the open-source verifier, without an AWS account.',
      'Each event carries origin and a deterministic risk score under a published policy, so review queues can be sorted by risk rather than read linearly.',
      'The core is open source and self-hostable on your own Postgres; the managed service is optional.',
    ],
    chooseThem:
      'You need to audit AWS infrastructure activity itself — IAM changes, resource creation, console sign-ins. That is CloudTrail’s job and nothing else does it as completely inside AWS.',
    chooseUs:
      'You need evidence of what your application and AI agents did — across clouds or on-prem — that reviewers outside your AWS account can independently verify.',
    table: [
      { dimension: 'Records', them: 'AWS API & management events', veritio: 'Application, agent, change & deploy events' },
      { dimension: 'Scope', them: 'AWS accounts', veritio: 'Any app, any infrastructure' },
      { dimension: 'Integrity', them: 'Signed digest files (within AWS)', veritio: 'Hash-linked chain, open verifier' },
      { dimension: 'Risk model', them: '—', veritio: 'Deterministic 0–1 scoring per policy' },
      { dimension: 'Hosting', them: 'AWS only', veritio: 'Self-hosted (OSS) or managed' },
      { dimension: 'Export audience', them: 'Your AWS tooling', veritio: 'Anyone, via open bundle + verifier' },
    ],
  },
  {
    slug: 'workos-audit-logs',
    name: 'WorkOS Audit Logs',
    heading: 'An open-source alternative to WorkOS Audit Logs',
    metaTitle: 'WorkOS Audit Logs alternative — open-source evidence layer | Veritio',
    metaDescription:
      'WorkOS Audit Logs is a hosted API for shipping enterprise audit trails fast. Veritio is an open-source evidence layer with hash-linked records, risk scoring, and independently verifiable exports.',
    what: 'WorkOS Audit Logs is a hosted API that lets B2B SaaS teams add enterprise-facing audit trails quickly: send events, get admin-portal viewing, retention, and SIEM export — alongside the rest of the WorkOS enterprise-readiness platform (SSO, SCIM).',
    strengths: [
      'Very fast path to "enterprise-ready" audit logs for a B2B SaaS checklist.',
      'Comes with an admin portal your customers’ IT teams can use directly.',
      'Fits naturally if you already use WorkOS for SSO and directory sync.',
      'SIEM streaming to customer-side tooling is built in.',
    ],
    differences: [
      'Veritio’s core is Apache-licensed open source — the schema, SDK, storage, and verifier run on your own Postgres with no vendor account.',
      'Records are hash-linked and exports are verifiable by third parties with the open verifier — evidence, not just a viewable log.',
      'Events carry deterministic risk scores under a published policy, and episodes roll up multi-step activity (agent sessions, deploys) for triage.',
      'AI agent activity is a first-class subject: sessions, tool calls, code changes, and deployments are modeled, not just generic actor/action rows.',
    ],
    chooseThem:
      'You sell B2B SaaS, your enterprise buyers ask for an audit-log tab and SIEM export, and you want the shortest path there — especially if you already run WorkOS SSO.',
    chooseUs:
      'You need tamper-evident evidence of application and AI-agent activity that survives vendor changes, self-hosts if needed, and can be handed to an external reviewer for independent verification.',
    table: [
      { dimension: 'Source model', them: 'Hosted API (proprietary)', veritio: 'Open-source core + optional managed cloud' },
      { dimension: 'Self-hosting', them: '—', veritio: 'Yes, on your Postgres' },
      { dimension: 'Integrity', them: 'Vendor-attested storage', veritio: 'Hash-linked chain, open verifier' },
      { dimension: 'Risk model', them: '—', veritio: 'Deterministic 0–1 scoring per policy' },
      { dimension: 'AI agent modeling', them: 'Generic events', veritio: 'Sessions, tool calls, changes, deploys, episodes' },
      { dimension: 'Customer-facing portal', them: 'Built-in admin portal', veritio: 'Console for your team; exports for others' },
    ],
  },
  {
    slug: 'langfuse',
    name: 'Langfuse',
    heading: 'Veritio vs Langfuse: evidence layer vs LLM observability',
    metaTitle: 'Langfuse alternative for AI agent evidence — Veritio',
    metaDescription:
      'Langfuse is open-source LLM observability: traces, evals, prompt management. Veritio records agent activity as hash-linked, risk-scored evidence for reviews — they solve different problems.',
    what: 'Langfuse is an open-source LLM engineering platform: tracing for LLM apps, evaluations, prompt management, and cost tracking. Teams use it to debug and improve LLM applications in development and production.',
    strengths: [
      'Deep LLM-native tracing: spans, generations, token usage, latencies.',
      'Evaluation tooling (LLM-as-judge, datasets, scores) built in.',
      'Prompt management with versioning and deployment.',
      'Open source with a generous self-hosting story, popular integrations.',
    ],
    differences: [
      'Different question: observability asks "why did the model answer this way?" — evidence asks "who did what, under whose authority, and can you prove it later?"',
      'Veritio records beyond the model call: code changes, deployments, human approvals, and security-relevant actions join agent sessions in one hash-linked chain.',
      'Records are tamper-evident and exportable for independent verification — built for reviews and investigations rather than debugging.',
      'Deterministic risk scoring ranks episodes for human attention; a canvas view reconstructs the episode for reviewers.',
    ],
    chooseThem:
      'You are building or operating an LLM application and need to debug traces, run evals, and manage prompts. That is what Langfuse is for, and Veritio does not replace it.',
    chooseUs:
      'You need a durable, verifiable record of what AI agents and the humans around them actually did — for governance reviews, customer questions, or incident reconstruction. Many teams will reasonably run both.',
    table: [
      { dimension: 'Primary question', them: 'Why did the LLM behave this way?', veritio: 'Who did what, and can you prove it?' },
      { dimension: 'Records', them: 'Traces, generations, evals', veritio: 'Hash-linked audit events & episodes' },
      { dimension: 'Beyond the model call', them: 'App-level traces', veritio: 'Code changes, deploys, approvals, security events' },
      { dimension: 'Tamper evidence', them: '—', veritio: 'Hash chain + open verifier' },
      { dimension: 'Risk model', them: 'Eval scores (quality)', veritio: 'Deterministic risk policy (governance)' },
      { dimension: 'Open source', them: 'Yes', veritio: 'Yes (core), managed cloud optional' },
    ],
  },
  {
    slug: 'diy-audit-tables',
    name: 'DIY audit tables',
    heading: 'Rolling your own audit tables vs using Veritio',
    metaTitle: 'Build vs buy: DIY audit tables vs an evidence layer — Veritio',
    metaDescription:
      'An events table with triggers is easy to start and hard to make tamper-evident, verifiable, and exportable. What a homegrown audit trail actually costs, honestly.',
    what: 'The default move: an `audit_events` table, some triggers or middleware, `actor`, `action`, `created_at`. Every team has built one. It works — until someone asks whether the history can be trusted, exported, or explained.',
    strengths: [
      'Zero new dependencies; lives in the database you already run.',
      'Total control over schema and retention.',
      'Perfectly adequate for internal debugging and light traceability.',
      'No procurement, no vendor review.',
    ],
    differences: [
      'Append-only by convention is not tamper-evident: anyone with a migration or DB access can rewrite history without trace. Veritio’s records are hash-linked, so any edit breaks the chain visibly.',
      'A table has no export story: handing a reviewer database access is not evidence. Veritio exports open, verifiable bundles a third party can check without touching your systems.',
      'Risk and structure come free: origin typing (user / service / AI agent), deterministic risk scores, and episode rollups — things a bare table grows only through years of accretion.',
      'The schema, SDK, and verifier are open source — you can adopt the structure without adopting a vendor.',
    ],
    chooseThem:
      'You need light internal traceability, your reviewers are your own engineers, and nobody will ever ask for proof that history was not rewritten. A plain table is genuinely fine for that.',
    chooseUs:
      'Someone — a customer, an auditor, a future you during an incident — will eventually ask "can you prove this happened as recorded?" Retrofitting tamper evidence onto years of mutable rows is much harder than starting with a chain.',
    table: [
      { dimension: 'Time to first row', them: 'An afternoon', veritio: 'An afternoon (npm install @veritio/core)' },
      { dimension: 'Tamper evidence', them: 'By convention only', veritio: 'Hash-linked chain' },
      { dimension: 'Independent verification', them: '—', veritio: 'Open verifier + export bundles' },
      { dimension: 'AI agent modeling', them: 'Roll your own', veritio: 'Sessions, tool calls, episodes built in' },
      { dimension: 'Risk scoring', them: 'Roll your own', veritio: 'Deterministic policy, 0–1 per event' },
      { dimension: 'Long-term cost', them: 'Accretes ad hoc', veritio: 'Maintained open protocol' },
    ],
  },
]
