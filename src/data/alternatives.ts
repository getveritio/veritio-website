/**
 * Data for /alternatives/* comparison pages. Rules (see CLAUDE.md):
 * honest, approach-level comparisons only — concede what the other tool does
 * well, date the review, never claim compliance outcomes, and only state
 * Veritio behavior that exists in the OSS repo or the hosted console.
 * Competitor claims must trace to primary sources (vendor docs/pricing pages,
 * source repos) checked at `lastReviewed` time.
 *
 * Hero images are pre-rendered PNGs (see scripts/generate-alt-images.mjs);
 * the SVG sources live in assets-src/alternatives and are not shipped.
 */
import type { ImageMetadata } from 'astro'
import imgCloudtrail from '../assets/alternatives/aws-cloudtrail-vs-veritio-application-evidence.png'
import imgWorkos from '../assets/alternatives/workos-audit-logs-vs-veritio-open-source-evidence.png'
import imgLangfuse from '../assets/alternatives/langfuse-vs-veritio-llm-observability-vs-evidence.png'
import imgDiy from '../assets/alternatives/diy-audit-tables-vs-veritio-tamper-evident-chain.png'
import imgLangsmith from '../assets/alternatives/langsmith-vs-veritio-tracing-vs-evidence.png'
import imgAuditkit from '../assets/alternatives/auditkit-vs-veritio-audit-log-sdk.png'

/** One row inside the hero panel's competitor pane. `tone: 'seal'` marks the
 * row that tells the cautionary part of the story (e.g. the rewritten row). */
export interface PanelRow {
  name: string
  detail?: string
  tone?: 'seal'
}

/** Data for the hero "VS" panel — the page's signature element. The left pane
 * shows the competitor's native view of the world; the right pane is always
 * Veritio's evidence chain, so only its rows vary per page. */
export interface VsPanel {
  themSub: string
  themTitle: string
  themRows: PanelRow[]
  themFoot: string
  chain: { action: string; risk?: string }[]
  usFoot: string
}

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
  /** Hero VS panel content. */
  panel: VsPanel
  /** One-line closer for the dark "stronger together" band. */
  closing: string
  /** Pre-rendered comparison diagram; used as the /alternatives index
   * thumbnail (and kept indexable for image search). */
  image?: { src: ImageMetadata; alt: string }
}

/** Default Veritio-side chain for the hero panel — a realistic episode:
 * agent session, tool call, code change, deploy, human approval. */
const defaultChain: VsPanel['chain'] = [
  { action: 'agent.session.started', risk: '0.05' },
  { action: 'agent.tool.called', risk: '0.18' },
  { action: 'code.change.recorded', risk: '0.34' },
  { action: 'deploy.completed', risk: '0.41' },
  { action: 'approval.granted', risk: '0.12' },
]

export const lastReviewed = 'August 2026'

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
    panel: {
      themSub: 'AWS control plane',
      themTitle: 'Management events',
      themRows: [
        { name: 'iam:CreateRole' },
        { name: 's3:PutBucketPolicy' },
        { name: 'signin:ConsoleLogin' },
        { name: 'kms:Decrypt' },
        { name: 'ec2:RunInstances' },
      ],
      themFoot: 'Who called which AWS API',
      chain: defaultChain,
      usFoot: 'What your app and agents did',
    },
    closing:
      'CloudTrail for your cloud account, Veritio for your application and its agents — two layers of one audit story.',
    image: {
      src: imgCloudtrail,
      alt: 'Layer diagram showing AWS CloudTrail recording infrastructure control-plane events below, and Veritio recording application, AI-agent, change, and deployment evidence above — complementary audit layers.',
    },
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
    panel: {
      themSub: 'Hosted audit-log API',
      themTitle: 'POST /audit_logs/events',
      themRows: [
        { name: 'your app', detail: 'sends events' },
        { name: 'vendor cloud', detail: 'attested' },
        { name: 'admin portal', detail: 'viewing' },
        { name: 'SIEM streaming', detail: 'Splunk' },
      ],
      themFoot: 'Integrity model: trust the vendor',
      chain: defaultChain,
      usFoot: 'Integrity model: verify the math',
    },
    closing:
      'An audit-log tab is a feature. Verifiable evidence is an asset that outlives any vendor — including us.',
    image: {
      src: imgWorkos,
      alt: 'Diagram contrasting WorkOS Audit Logs as a hosted API with Veritio’s open-source evidence layer: events flowing into a vendor-attested store versus a hash-linked chain on your own Postgres with an offline verifier.',
    },
  },
  {
    slug: 'langfuse',
    name: 'Langfuse',
    heading: 'Veritio vs Langfuse: evidence layer vs LLM observability',
    metaTitle: 'Langfuse alternative for AI agent evidence — Veritio',
    metaDescription:
      'Langfuse is open-source LLM observability: traces, evals, prompt management. Veritio records agent activity as hash-linked, risk-scored evidence for reviews — they solve different problems.',
    what: 'Langfuse is an open-source LLM engineering platform: tracing for LLM apps, evaluations, prompt management, and cost tracking. Teams use it to debug and improve LLM applications in development and production. In January 2026 Langfuse was acquired by ClickHouse, which has publicly committed to keeping the MIT core and self-hosting available.',
    strengths: [
      'Deep LLM-native tracing: spans, generations, token usage, latencies.',
      'Evaluation tooling (LLM-as-judge, datasets, scores) built in.',
      'Prompt management with versioning and deployment.',
      'MIT-licensed core with a real self-hosting story and 100+ integrations, OpenTelemetry-native.',
    ],
    differences: [
      'Different question: observability asks "why did the model answer this way?" — evidence asks "who did what, under whose authority, and can you prove it later?"',
      'Veritio records beyond the model call: code changes, deployments, human approvals, and security-relevant actions join agent sessions in one hash-linked chain.',
      'Records are tamper-evident and exportable for independent verification — built for reviews and investigations rather than debugging. Langfuse’s audit logs are an Enterprise-gated feature that covers admin actions on the Langfuse platform itself (API keys, prompts, projects), not your application’s or agents’ activity, and carries no cryptographic verification.',
      'Deterministic risk scoring ranks episodes for human attention; a canvas view reconstructs the episode for reviewers.',
      'Self-hosting Veritio’s authoritative store needs only the Postgres you already run; a production Langfuse deployment runs Postgres, ClickHouse, Redis/Valkey, and S3-compatible blob storage.',
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
      { dimension: 'Audit logs', them: 'Enterprise-gated; Langfuse admin actions only', veritio: 'Core feature; your app & agent activity' },
      { dimension: 'Risk model', them: 'Eval scores (quality)', veritio: 'Deterministic risk policy (governance)' },
      { dimension: 'Self-host footprint', them: 'Postgres + ClickHouse + Redis + S3', veritio: 'Your Postgres (authoritative store)' },
      { dimension: 'Open source', them: 'Yes (MIT core, ee/ licensed)', veritio: 'Yes (core), managed cloud optional' },
    ],
    panel: {
      themSub: 'Tracing & evaluation',
      themTitle: 'Trace (debugging)',
      themRows: [
        { name: 'agent.run', detail: '8.4s' },
        { name: 'llm.generation', detail: '1.2k tok' },
        { name: 'tool.search', detail: '12 docs' },
        { name: 'llm.generation', detail: '3.0k tok' },
        { name: 'eval.judge', detail: '0.87' },
      ],
      themFoot: 'Answers: why did the model behave this way?',
      chain: defaultChain,
      usFoot: 'Answers: who did what — and can you prove it?',
    },
    closing:
      'Many teams run both: Langfuse for observability, Veritio for verifiable evidence. Different questions, better answers.',
    image: {
      src: imgLangfuse,
      alt: 'Diagram comparing Langfuse LLM observability traces with Veritio hash-linked evidence records: a trace tree for debugging on the left, a tamper-evident audit chain with risk scores and an offline verifier on the right.',
    },
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
    panel: {
      themSub: 'audit_events table',
      themTitle: 'Mutable rows',
      themRows: [
        { name: '1040 · user.role.updated', detail: '14:02:11' },
        { name: '1041 · invoice.deleted', detail: '14:02:58' },
        { name: '1042 · user.read', detail: 'rewritten — no trace', tone: 'seal' },
        { name: '1043 · user.invited', detail: '14:07:44' },
      ],
      themFoot: 'Append-only by convention',
      chain: defaultChain,
      usFoot: 'The same edit breaks the chain — visibly',
    },
    closing:
      'Keep your table for debugging. Add a chain for the day someone asks for proof.',
    image: {
      src: imgDiy,
      alt: 'Diagram of a homegrown audit_events table where a row was silently rewritten, next to a Veritio hash-linked chain where the same edit visibly breaks the chain at the tampered record.',
    },
  },
  {
    slug: 'langsmith',
    name: 'LangSmith',
    heading: 'Veritio vs LangSmith: agent evidence vs LLM tracing & evals',
    metaTitle: 'LangSmith alternative for AI agent evidence — Veritio',
    metaDescription:
      'LangSmith is LangChain’s platform for tracing, evals, and agent deployment. Veritio records agent activity as hash-linked, risk-scored evidence anyone can verify offline — different problems, honestly compared.',
    what: 'LangSmith is LangChain’s commercial platform for building and operating LLM applications: tracing and observability, evaluations, prompt engineering, and agent deployment. It is the natural companion to LangChain and LangGraph, though it works with other frameworks too.',
    strengths: [
      'First-class tracing for LangChain/LangGraph apps — agent steps, tool calls, and graph state render naturally.',
      'Evaluations, dataset management, and human feedback queues built into the same workflow.',
      'Prompt engineering tools and a deployment path (cloud, hybrid, or self-hosted on enterprise plans).',
      'Low-friction start: free single-seat Developer tier, then $39 per seat on Plus (as of August 2026).',
    ],
    differences: [
      'Different question: LangSmith asks "is the application behaving well?" — Veritio asks "who did what, under whose authority, and can you prove it later?"',
      'LangSmith is a proprietary platform; self-hosting is an enterprise-plan option. Veritio’s protocol, SDKs, storage, and verifier are Apache-licensed open source that run on your own Postgres without an account.',
      'Veritio records are hash-linked and export to an open bundle format that a third party can verify offline with the open-source verifier — traces and dashboards are not evidence a reviewer can independently check.',
      'Veritio captures the activity around the model too: code changes, deployments, approvals, and security-relevant actions join agent sessions in one chain, with deterministic risk scores for triage.',
    ],
    chooseThem:
      'You build on LangChain or LangGraph and need to debug traces, run evals, and ship agents with an integrated toolchain. That is LangSmith’s home turf, and Veritio does not replace it.',
    chooseUs:
      'You need a durable, independently verifiable record of what AI agents and the humans around them did — for governance reviews, customer questions, or incident reconstruction. Running both is a reasonable setup.',
    table: [
      { dimension: 'Primary question', them: 'Is the app behaving well?', veritio: 'Who did what, and can you prove it?' },
      { dimension: 'Records', them: 'Traces, evals, feedback', veritio: 'Hash-linked audit events & episodes' },
      { dimension: 'Source model', them: 'Proprietary SaaS', veritio: 'Apache-licensed open core' },
      { dimension: 'Self-hosting', them: 'Enterprise plans', veritio: 'Yes, on your Postgres — no account' },
      { dimension: 'Tamper evidence', them: '—', veritio: 'Hash chain + open verifier' },
      { dimension: 'Beyond the model call', them: 'App-level traces', veritio: 'Code changes, deploys, approvals, security events' },
      { dimension: 'Risk model', them: 'Eval scores (quality)', veritio: 'Deterministic risk policy (governance)' },
    ],
    panel: {
      themSub: 'Tracing, evals & deployment',
      themTitle: 'Trace & evals',
      themRows: [
        { name: 'plan', detail: 'graph node' },
        { name: 'tool: search', detail: 'graph node' },
        { name: 'respond', detail: 'graph node' },
        { name: 'eval: correctness', detail: '0.91' },
        { name: 'eval: helpfulness', detail: '0.88' },
      ],
      themFoot: 'Answers: is the application behaving well?',
      chain: defaultChain,
      usFoot: 'Answers: who did what — and can you prove it?',
    },
    closing:
      'Many teams run both: LangSmith to build and evaluate, Veritio to prove what shipped.',
    image: {
      src: imgLangsmith,
      alt: 'Diagram comparing LangSmith tracing and evaluation of an agent run with Veritio’s hash-linked evidence chain covering the same run plus code changes, deployment, and human approval events.',
    },
  },
  {
    slug: 'auditkit',
    name: 'AuditKit',
    heading: 'Veritio vs AuditKit: two takes on tamper-evident audit logs',
    metaTitle: 'AuditKit alternative — open-source evidence layer with agent provenance | Veritio',
    metaDescription:
      'AuditKit (auditkit.dev) is an AGPL audit-log SDK with hash chains and Merkle proofs. Veritio is an Apache-licensed evidence protocol that also records AI-agent activity. An honest comparison.',
    what: 'AuditKit (auditkit.dev) is a new audit-logging SDK, first released in June 2026, offering SHA-256 hash-chained logs with Merkle proofs, SDKs for TypeScript, Python, Go, and Java, SIEM streaming, and an embeddable log viewer, under an AGPLv3 core with paid tiers. Note the name collision: an unrelated, Apache-licensed SOC 2 compliance scanner CLI also goes by AuditKit (auditkit.io) — this page is about the audit-log SDK.',
    strengths: [
      'Closest neighbour in spirit: hash-chained, tenant-scoped audit logs as a developer product, not an afterthought.',
      'Merkle-proof verification (on paid tiers) and SIEM streaming to Splunk, Datadog, Elastic, or S3.',
      'An embeddable React viewer for showing audit history inside your product.',
      'SOC 2-oriented exports and policy templates aimed squarely at the B2B compliance checklist.',
    ],
    differences: [
      'AI-agent activity is a first-class subject in Veritio: agent sessions, tool calls, code changes, and deployments are modeled and hash-chained with provenance, not just generic actor/action rows. AuditKit records standard application audit context.',
      'Licensing: Veritio’s core protocol, SDKs, storage helpers, and verifier are Apache-2.0; AuditKit’s core is AGPLv3 with commercial tiers, and some verification features sit behind paid plans.',
      'Veritio is protocol-first: TypeScript, Python, and Go SDKs produce byte-identical hashes and risk scores, pinned by public conformance fixtures — the format outlives any one vendor or SDK.',
      'Evidence leaves the system: signed export bundles verify offline with the open verifier, no vendor account or running service required. Veritio also ships deterministic risk scoring under a published policy for review triage.',
    ],
    chooseThem:
      'You want a batteries-included audit-log feature for a classic B2B SaaS — viewer, SIEM streaming, SOC 2 exports — and the AGPL-plus-paid-tiers model fits how you ship. It is a young project, so evaluate maturity against your own bar.',
    chooseUs:
      'You need one evidence layer for both application activity and AI-agent provenance, an Apache-licensed protocol with cross-language conformance, and exports a third party can verify without trusting you or any vendor.',
    table: [
      { dimension: 'Integrity model', them: 'SHA-256 chain + Merkle proofs', veritio: 'SHA-256 hash chain + signed export bundles' },
      { dimension: 'Independent verification', them: 'Merkle proofs (paid tiers)', veritio: 'Open-source offline verifier, free' },
      { dimension: 'AI agent modeling', them: 'Generic events', veritio: 'Sessions, tool calls, changes, deploys, episodes' },
      { dimension: 'Risk model', them: '—', veritio: 'Deterministic 0–1 scoring per policy' },
      { dimension: 'License', them: 'AGPLv3 core + commercial tiers', veritio: 'Apache-2.0 core + optional managed cloud' },
      { dimension: 'SDK parity', them: 'TS, Python, Go, Java', veritio: 'TS, Python, Go — byte-identical, fixture-pinned' },
      { dimension: 'First released', them: 'June 2026', veritio: '2026, protocol + fixtures public from day one' },
    ],
    panel: {
      themSub: 'Audit-log SDK (auditkit.dev)',
      themTitle: 'Hash-chained log',
      themRows: [
        { name: 'SHA-256 chain', detail: 'tenant-scoped' },
        { name: 'Merkle proofs', detail: 'paid tiers' },
        { name: 'SDKs', detail: 'TS · Python · Go · Java' },
        { name: 'SIEM streaming', detail: 'Splunk · Datadog · Elastic' },
        { name: 'agent provenance', detail: 'not modeled', tone: 'seal' },
      ],
      themFoot: 'Classic application audit only',
      chain: defaultChain,
      usFoot: 'App and agent evidence in one chain',
    },
    closing:
      'Both projects believe audit logs should be verifiable. Veritio extends that to what AI agents do.',
    image: {
      src: imgAuditkit,
      alt: 'Two-axis map comparing AuditKit and Veritio: both offer hash-chained application audit logs, but Veritio additionally covers AI-agent provenance — sessions, tool calls, code changes, and deployments — under an Apache-2.0 protocol.',
    },
  },
]
