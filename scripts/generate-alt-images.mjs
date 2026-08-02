/**
 * Renders the /alternatives comparison artwork: one in-page hero PNG per page
 * (src/assets/alternatives/*.png, consumed via astro:assets) and one 1200×630
 * OG card per page (public/og/<slug>.png, raw-served for social crawlers).
 *
 * Run manually with `bun run images:alt` after editing the art below; outputs
 * are committed. SVG sources are composed in-memory here (design tokens must
 * mirror src/styles/global.css) and rasterized with @resvg/resvg-js using the
 * vendored OFL-licensed TTFs in assets-src/fonts — resvg cannot read the
 * woff2 files that @fontsource ships, which is why the TTFs exist. We ship
 * raster PNGs deliberately: they index in image search and social cards, and
 * the dossier aesthetic depends on exact font rendering.
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONT_DIR = join(root, 'assets-src', 'fonts')
const HERO_DIR = join(root, 'src', 'assets', 'alternatives')
const OG_DIR = join(root, 'public', 'og')
const SRC_DIR = join(root, 'assets-src', 'alternatives')

// Mirror of the @theme tokens in src/styles/global.css.
const C = {
  surface: '#f6f3ea',
  raised: '#fbf9f2',
  sunken: '#eeeadc',
  invert: '#10231b',
  ink: '#1a231e',
  soft: '#414c44',
  muted: '#5d685f',
  evergreen: '#1f3b30',
  accent: '#2f6f57',
  accentStrong: '#235943',
  seal: '#b23c2e',
  line: '#ddd6c2',
  lineStrong: '#c6bda1',
  codeBg: '#f0ecdf',
}
const SERIF = 'Newsreader'
const MONO = 'IBM Plex Mono'

const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Mono text — the voice for anything that is data, metadata, or a label. */
const mono = (x, y, text, { size = 11, color = C.soft, weight = 400, ls = 0, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="${ls}" text-anchor="${anchor}" xml:space="preserve">${esc(text)}</text>`

/** Uppercase tracked eyebrow label, same convention as the site's .eyebrow. */
const eyebrow = (x, y, text, { color = C.accent, size = 11, anchor = 'start' } = {}) =>
  mono(x, y, text.toUpperCase(), { size, color, weight: 600, ls: 1.6, anchor })

/** Serif display text — Newsreader carries titles, as on the site. */
const serif = (x, y, text, { size = 30, color = C.ink, weight = 600, anchor = 'start', ls = -0.3 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="${ls}" text-anchor="${anchor}">${esc(text)}</text>`

const rect = (x, y, w, h, { fill = 'none', stroke = C.line, sw = 1, dash = '' } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${sw}"` : ''} ${dash ? `stroke-dasharray="${dash}"` : ''}/>`

const hline = (x1, x2, y, { stroke = C.line, sw = 1, dash = '' } = {}) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`

const vline = (x, y1, y2, { stroke = C.line, sw = 1, dash = '' } = {}) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`

/** Hairline panel with an eyebrow label cut into the top rule — the site's
 * "ruled paper, no cards" convention. */
function panel(x, y, w, h, label, { fill = C.raised, labelColor = C.muted } = {}) {
  const pad = 10
  const labelW = label.length * 7.6 + pad * 2
  return [
    rect(x, y, w, h, { fill, stroke: C.line }),
    rect(x + 14, y - 8, labelW, 16, { fill: C.surface, stroke: '' }),
    eyebrow(x + 14 + pad, y + 4, label, { color: labelColor, size: 10.5 }),
  ].join('')
}

/** One hash-linked evidence record row + the dot/link spine at `spineX`. */
function chainRow(spineX, y, seq, action, hash, risk, { riskColor = C.accent } = {}) {
  const parts = [
    `<circle cx="${spineX}" cy="${y - 4}" r="3.2" fill="${C.accent}"/>`,
    mono(spineX + 16, y, seq, { size: 10.5, color: C.muted }),
    mono(spineX + 58, y, action, { size: 11.5, color: C.ink, weight: 600 }),
    mono(spineX + 16, y + 15, `sha256:${hash}  ·  links prev`, { size: 10, color: C.muted }),
  ]
  if (risk !== null) parts.push(mono(spineX + 268, y, `risk ${risk}`, { size: 10.5, color: riskColor, weight: 500 }))
  return parts.join('')
}

/** VERIFY stamp — the seal moment. Accent when valid, seal red when broken. */
function verifyStamp(x, y, valid, note) {
  const color = valid ? C.accentStrong : C.seal
  const label = valid ? 'VERIFY: VALID' : 'VERIFY: INVALID'
  const w = 132
  return [
    rect(x, y, w, 26, { stroke: color, sw: 1.4 }),
    eyebrow(x + 10, y + 17, label, { color, size: 10.5 }),
    mono(x + w + 12, y + 17, note, { size: 10, color: C.muted }),
  ].join('')
}

const HERO_W = 1240
const HERO_H = 640

/** Shared dossier chrome: outer hairline, header block, footer rule. The
 * per-slug `body` draws inside y ∈ [150, 596]. */
function heroShell(slug, title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}" viewBox="0 0 ${HERO_W} ${HERO_H}">
  <rect width="${HERO_W}" height="${HERO_H}" fill="${C.surface}"/>
  ${rect(0.5, 0.5, HERO_W - 1, HERO_H - 1, { stroke: C.lineStrong })}
  ${eyebrow(40, 46, 'Veritio · evidence comparison')}
  ${mono(HERO_W - 40, 46, `getveritio.com/alternatives/${slug} · reviewed aug 2026`, { size: 10, color: C.muted, anchor: 'end' })}
  ${hline(40, HERO_W - 40, 60, { stroke: C.line })}
  ${serif(40, 104, title, { size: 34 })}
  ${mono(40, 128, subtitle, { size: 11.5, color: C.muted })}
  ${body}
  ${hline(40, HERO_W - 40, 606, { stroke: C.line })}
  ${mono(40, 624, 'Veritio provides evidence support for reviews and investigations — not automatic compliance.', { size: 9.5, color: C.muted })}
  ${mono(HERO_W - 40, 624, 'apache-2.0 · github.com/getveritio/veritio', { size: 9.5, color: C.muted, anchor: 'end' })}
</svg>`
}

/** Standard right-hand panel: Veritio's hash-linked chain ending in a VALID
 * stamp. Reused wherever the contrast is "their view" vs "our proof". */
function veritioChainPanel(x, y, w, h, rows, { label = 'Veritio — evidence chain (proof)' } = {}) {
  const spine = x + 26
  const step = 58
  const out = [panel(x, y, w, h, label, { labelColor: C.accentStrong })]
  let ry = y + 52
  out.push(vline(spine, ry - 8, ry + (rows.length - 1) * step - 8, { stroke: C.accent, sw: 1.2 }))
  for (const r of rows) {
    out.push(chainRow(spine, ry, ...r))
    ry += step
  }
  out.push(verifyStamp(x + 16, y + h - 42, true, 'offline · no vendor, no account'))
  return out.join('')
}

// ---------------------------------------------------------------------------
// Per-slug hero bodies
// ---------------------------------------------------------------------------

function heroLangfuse() {
  const L = 40, Lw = 560, R = 640, Rw = 560, top = 158, hgt = 420
  const t = []
  t.push(panel(L, top, Lw, hgt, 'Langfuse — trace (debugging)'))
  let y = top + 48
  const tx = L + 24
  t.push(mono(tx, y, 'agent.run', { size: 12, color: C.ink, weight: 600 }))
  t.push(mono(tx + 300, y, '8.4s · $0.062', { size: 10.5, color: C.muted }))
  const spans = [
    ['llm.generation', 'gpt-4.1 · 1,204 tok', '1.9s', 150],
    ['tool.search', 'retrieval · 12 docs', '412ms', 36],
    ['llm.generation', 'gpt-4.1 · 2,988 tok', '2.3s', 188],
    ['eval.judge', 'helpfulness', '0.87', 60],
  ]
  y += 40
  for (const [name, detail, metric, barW] of spans) {
    t.push(vline(tx + 6, y - 26, y - 4, { stroke: C.lineStrong }))
    t.push(hline(tx + 6, tx + 18, y - 4, { stroke: C.lineStrong }))
    t.push(mono(tx + 26, y, name, { size: 11.5, color: C.soft, weight: 500 }))
    t.push(mono(tx + 180, y, detail, { size: 10.5, color: C.muted }))
    t.push(mono(tx + 380, y, metric, { size: 10.5, color: C.muted }))
    // span duration bar, the observability visual signature
    t.push(rect(tx + 26, y + 10, barW, 4, { fill: C.sunken, stroke: '' }))
    y += 58
  }
  t.push(mono(tx, top + hgt - 58, 'answers: why did the model behave this way?', { size: 11, color: C.soft }))
  t.push(mono(tx, top + hgt - 38, 'traces are mutable app data — not reviewable proof', { size: 10.5, color: C.muted }))
  t.push(veritioChainPanel(R, top, Rw, hgt, [
    ['0141', 'agent.session.started', '9f2c41ae…', '0.05'],
    ['0142', 'agent.tool.called', '5b81d903…', '0.18'],
    ['0143', 'code.change.recorded', 'c4077bf2…', '0.34'],
    ['0144', 'deploy.completed', '12aa60c8…', '0.41'],
    ['0145', 'approval.granted', 'e77b52d1…', null],
  ]))
  t.push(mono(R + 26, top + hgt - 58, 'answers: who did what — and can you prove it later?', { size: 11, color: C.accentStrong, weight: 500 }))
  return heroShell(
    'langfuse',
    'Langfuse vs Veritio',
    'LLM observability and an evidence layer answer different questions — many teams run both.',
    t.join(''),
  )
}

function heroLangsmith() {
  const L = 40, Lw = 560, R = 640, Rw = 560, top = 158, hgt = 420
  const t = []
  t.push(panel(L, top, Lw, hgt, 'LangSmith — trace & evals'))
  // LangGraph-style node row
  const ny = top + 84
  const nodes = [
    ['plan', L + 40],
    ['tool: search', L + 190],
    ['respond', L + 380],
  ]
  for (const [label, x] of nodes) {
    t.push(rect(x, ny - 24, 120, 38, { fill: C.codeBg, stroke: C.lineStrong }))
    t.push(mono(x + 60, ny, label, { size: 11.5, color: C.ink, weight: 500, anchor: 'middle' }))
  }
  t.push(hline(L + 160, L + 190, ny - 5, { stroke: C.lineStrong }))
  t.push(hline(L + 310, L + 380, ny - 5, { stroke: C.lineStrong }))
  t.push(mono(L + 24, ny + 56, 'graph state · agent steps · tool I/O rendered natively', { size: 10.5, color: C.muted }))
  // eval chips
  const ey = ny + 118
  t.push(eyebrow(L + 24, ey - 14, 'evals', { color: C.muted, size: 10 }))
  const chips = [
    ['correctness 0.91', L + 24],
    ['helpfulness 0.88', L + 196],
    ['tone 0.79', L + 368],
  ]
  for (const [label, x] of chips) {
    t.push(rect(x, ey, 156, 28, { stroke: C.line }))
    t.push(mono(x + 12, ey + 18, label, { size: 10.5, color: C.soft }))
  }
  t.push(mono(L + 24, ey + 64, 'datasets · experiments · human feedback queues · prompt hub', { size: 10.5, color: C.muted }))
  t.push(mono(L + 24, top + hgt - 58, 'answers: is the application behaving well?', { size: 11, color: C.soft }))
  t.push(mono(L + 24, top + hgt - 38, 'proprietary platform · self-hosting on enterprise plans', { size: 10.5, color: C.muted }))
  t.push(veritioChainPanel(R, top, Rw, hgt, [
    ['0207', 'agent.session.started', '77c1b0ee…', '0.05'],
    ['0208', 'agent.tool.called', '0d94ac21…', '0.18'],
    ['0209', 'code.change.recorded', 'f31e88d0…', '0.34'],
    ['0210', 'approval.granted', '8c25d67a…', null],
    ['0211', 'deploy.completed', '41b7f9c3…', '0.41'],
  ]))
  t.push(mono(R + 26, top + hgt - 58, 'the humans and deploys around the agent join the same chain', { size: 10.5, color: C.accentStrong, weight: 500 }))
  return heroShell(
    'langsmith',
    'LangSmith vs Veritio',
    'Tracing & evals improve the app. Hash-linked evidence proves what the app and its agents did.',
    t.join(''),
  )
}

function heroWorkos() {
  const L = 40, Lw = 560, R = 640, Rw = 560, top = 158, hgt = 420
  const t = []
  t.push(panel(L, top, Lw, hgt, 'WorkOS Audit Logs — hosted API'))
  t.push(rect(L + 24, top + 44, 150, 40, { stroke: C.lineStrong }))
  t.push(mono(L + 99, top + 68, 'your app', { size: 11.5, color: C.ink, weight: 500, anchor: 'middle' }))
  t.push(hline(L + 174, L + 280, top + 64, { stroke: C.lineStrong }))
  t.push(mono(L + 182, top + 52, 'POST /events', { size: 9.5, color: C.muted }))
  // the closed vendor box — the one solid fill on the page
  t.push(rect(L + 280, top + 36, 256, 120, { fill: C.invert, stroke: '' }))
  t.push(mono(L + 300, top + 64, 'vendor cloud', { size: 12, color: C.surface, weight: 600 }))
  t.push(mono(L + 300, top + 86, 'vendor-attested storage', { size: 10.5, color: '#9db3a8' }))
  t.push(mono(L + 300, top + 104, 'retention · admin portal', { size: 10.5, color: '#9db3a8' }))
  t.push(mono(L + 300, top + 122, 'SIEM streaming', { size: 10.5, color: '#9db3a8' }))
  t.push(mono(L + 24, top + 200, 'fast path to the enterprise checklist — audit tab,', { size: 11, color: C.soft }))
  t.push(mono(L + 24, top + 218, 'portal, SIEM export, alongside SSO and SCIM', { size: 11, color: C.soft }))
  t.push(mono(L + 24, top + hgt - 58, 'integrity model: trust the vendor', { size: 11, color: C.soft }))
  t.push(mono(L + 24, top + hgt - 38, 'closed source · hosted only', { size: 10.5, color: C.muted }))
  // right: open pipeline
  t.push(panel(R, top, Rw, hgt, 'Veritio — open protocol', { labelColor: C.accentStrong }))
  const steps = [
    ['your app', '@veritio/core'],
    ['redact / hash / chain', 'deterministic, in your process'],
    ['your Postgres', 'append-only, gapless per tenant'],
    ['vevb-1 export bundle', 'signed, portable evidence'],
  ]
  let sy = top + 52
  steps.forEach(([head, sub], i) => {
    t.push(`<circle cx="${R + 26}" cy="${sy - 4}" r="3.2" fill="${C.accent}"/>`)
    t.push(mono(R + 42, sy, head, { size: 11.5, color: C.ink, weight: 600 }))
    t.push(mono(R + 42, sy + 15, sub, { size: 10, color: C.muted }))
    if (i < steps.length - 1) t.push(vline(R + 26, sy + 2, sy + 40, { stroke: C.accent, sw: 1.2 }))
    sy += 56
  })
  t.push(verifyStamp(R + 16, top + hgt - 42, true, 'anyone can verify — no WorkOS, no Veritio account'))
  t.push(mono(R + 26, top + hgt - 58, 'integrity model: verify the math', { size: 11, color: C.accentStrong, weight: 500 }))
  return heroShell(
    'workos-audit-logs',
    'WorkOS Audit Logs vs Veritio',
    'A hosted audit-log API you trust, or an open evidence protocol anyone can verify.',
    t.join(''),
  )
}

function heroCloudtrail() {
  const L = 40, W = 1160, top = 158
  const t = []
  // top layer: application/agent evidence
  t.push(panel(L, top, W, 176, 'Your application & agents — Veritio', { labelColor: C.accentStrong }))
  const evs = [
    ['user.consent.recorded', 'risk 0.08'],
    ['agent.session.started', 'risk 0.05'],
    ['code.change.recorded', 'risk 0.34'],
    ['deploy.completed', 'risk 0.41'],
    ['dsar.export.completed', 'risk 0.22'],
  ]
  const cw = 205, gap = 14
  let cx = L + 24
  const cy = top + 52
  for (const [name, risk] of evs) {
    t.push(rect(cx, cy, cw, 56, { fill: C.raised, stroke: C.line }))
    t.push(mono(cx + 12, cy + 22, name, { size: 10.5, color: C.ink, weight: 600 }))
    t.push(mono(cx + 12, cy + 40, `sha256:… · ${risk}`, { size: 9.5, color: C.muted }))
    if (cx + cw + gap < L + W - 24) t.push(hline(cx + cw, cx + cw + gap, cy + 28, { stroke: C.accent, sw: 1.2 }))
    cx += cw + gap
  }
  t.push(mono(L + 24, top + 146, 'hash-linked · any cloud or on-prem · exports verify offline with the open verifier', { size: 10.5, color: C.accentStrong, weight: 500 }))
  // middle divider
  t.push(mono(HERO_W / 2, top + 218, 'COMPLEMENTARY LAYERS — DIFFERENT QUESTIONS', { size: 10.5, color: C.muted, weight: 600, ls: 1.6, anchor: 'middle' }))
  t.push(vline(HERO_W / 2 - 220, top + 190, top + 240, { stroke: C.lineStrong, dash: '3 4' }))
  t.push(vline(HERO_W / 2 + 220, top + 190, top + 240, { stroke: C.lineStrong, dash: '3 4' }))
  // bottom layer: cloudtrail
  t.push(panel(L, top + 258, W, 162, 'AWS control plane — CloudTrail'))
  const aws = ['iam:CreateRole', 's3:PutBucketPolicy', 'signin:ConsoleLogin', 'kms:Decrypt', 'ec2:RunInstances']
  cx = L + 24
  for (const name of aws) {
    t.push(rect(cx, top + 310, cw, 44, { fill: C.codeBg, stroke: C.line }))
    t.push(mono(cx + 12, top + 337, name, { size: 10.5, color: C.soft, weight: 500 }))
    cx += cw + gap
  }
  t.push(mono(L + 24, top + 396, 'who called which AWS API — management events on by default, delivered to S3 / CloudTrail Lake', { size: 10.5, color: C.muted }))
  return heroShell(
    'aws-cloudtrail',
    'AWS CloudTrail vs Veritio',
    'CloudTrail audits your AWS account. Veritio audits your application and its AI agents. You likely need both.',
    t.join(''),
  )
}

function heroDiy() {
  const L = 40, Lw = 560, R = 640, Rw = 560, top = 158, hgt = 420
  const t = []
  t.push(panel(L, top, Lw, hgt, 'DIY — audit_events table (mutable)'))
  t.push(mono(L + 24, top + 40, 'id'.padEnd(8) + 'actor'.padEnd(11) + 'action'.padEnd(24) + 'created_at', { size: 10.5, color: C.muted }))
  t.push(hline(L + 24, L + Lw - 24, top + 50, { stroke: C.lineStrong }))
  const rows = [
    ['1040', 'usr_c81', 'user.role.updated', '14:02:11'],
    ['1041', 'svc_api', 'invoice.deleted', '14:02:58'],
    ['1042', 'usr_c81', 'billing.key.viewed', '14:03:20'],
    ['1043', 'usr_9ae', 'user.invited', '14:07:44'],
  ]
  let y = top + 78
  for (const [id, actor, action, ts] of rows) {
    const tampered = id === '1042'
    if (tampered) t.push(rect(L + 16, y - 16, Lw - 32, 26, { fill: C.sunken, stroke: '' }))
    t.push(mono(L + 24, y, `${id}    ${actor.padEnd(11)}${(tampered ? 'user.read' : action).padEnd(24)}${ts}`, {
      size: 10.5,
      color: tampered ? C.seal : C.soft,
      weight: tampered ? 500 : 400,
    }))
    y += 42
  }
  t.push(mono(L + 24, y + 26, `UPDATE audit_events SET action='user.read' WHERE id=1042;`, { size: 10.5, color: C.muted }))
  t.push(mono(L + 24, y + 48, '-> history rewritten. nothing noticed.', { size: 11, color: C.seal, weight: 500 }))
  t.push(mono(L + 24, top + hgt - 58, 'append-only by convention', { size: 11, color: C.soft }))
  t.push(mono(L + 24, top + hgt - 38, 'anyone with a migration can edit the past', { size: 10.5, color: C.muted }))
  // right: chain with visible break
  t.push(panel(R, top, Rw, hgt, 'Veritio — the same edit breaks the chain', { labelColor: C.accentStrong }))
  const spine = R + 26
  const chain = [
    ['1040', 'user.role.updated', 'b3c9d1a2…', false],
    ['1041', 'invoice.deleted', '6f02e8b7…', false],
    ['1042', 'billing.key.viewed', 'MISMATCH', true],
    ['1043', 'user.invited', '(unverifiable)', true],
  ]
  let ry = top + 60
  chain.forEach(([seq, action, hash, broken], i) => {
    t.push(`<circle cx="${spine}" cy="${ry - 4}" r="3.2" fill="${broken ? C.seal : C.accent}"/>`)
    t.push(mono(spine + 16, ry, seq, { size: 10.5, color: C.muted }))
    t.push(mono(spine + 58, ry, action, { size: 11.5, color: broken ? C.seal : C.ink, weight: 600 }))
    t.push(mono(spine + 16, ry + 15, broken ? `sha256:${hash}` : `sha256:${hash} · links prev`, { size: 10, color: broken ? C.seal : C.muted }))
    if (i < chain.length - 1) {
      const nextBroken = chain[i + 1][3]
      t.push(vline(spine, ry + 2, ry + 60, { stroke: nextBroken ? C.seal : C.accent, sw: 1.2, dash: nextBroken ? '3 4' : '' }))
    }
    ry += 68
  })
  t.push(verifyStamp(R + 16, top + hgt - 42, false, 'chain breaks at seq 1042 — tampering is visible'))
  return heroShell(
    'diy-audit-tables',
    'DIY audit tables vs Veritio',
    'A plain table is fine until someone asks whether history can be trusted.',
    t.join(''),
  )
}

function heroAuditkit() {
  const top = 158
  const t = []
  // two-axis map
  const ox = 140, oy = top + 380, w = 780, h = 330
  t.push(vline(ox, oy - h, oy, { stroke: C.lineStrong }))
  t.push(hline(ox, ox + w, oy, { stroke: C.lineStrong }))
  t.push(eyebrow(ox + w - 240, oy + 24, 'classic application audit ->', { color: C.muted, size: 10 }))
  t.push(`<text x="${ox - 18}" y="${oy - h + 10}" font-family="${MONO}" font-size="10" font-weight="600" fill="${C.muted}" letter-spacing="1.6" transform="rotate(-90 ${ox - 18} ${oy - h + 10})" text-anchor="end">AI-AGENT PROVENANCE -&gt;</text>`)
  // AuditKit marker: far right on x, low on y
  t.push(rect(ox + 500, oy - 106, 250, 86, { fill: C.raised, stroke: C.lineStrong }))
  t.push(mono(ox + 516, oy - 82, 'AuditKit (auditkit.dev)', { size: 11.5, color: C.ink, weight: 600 }))
  t.push(mono(ox + 516, oy - 64, 'SHA-256 chain · Merkle proofs', { size: 10, color: C.muted }))
  t.push(mono(ox + 516, oy - 48, 'AGPLv3 core · paid tiers', { size: 10, color: C.muted }))
  t.push(mono(ox + 516, oy - 32, 'first released June 2026', { size: 10, color: C.muted }))
  // Veritio region: spans both axes
  t.push(rect(ox + 340, oy - h + 16, 410, 150, { fill: C.raised, stroke: C.accent, sw: 1.4 }))
  t.push(mono(ox + 356, oy - h + 42, 'Veritio', { size: 12.5, color: C.accentStrong, weight: 600 }))
  t.push(mono(ox + 356, oy - h + 62, 'hash chain + signed vevb-1 bundles · offline verifier', { size: 10, color: C.soft }))
  t.push(mono(ox + 356, oy - h + 80, 'agent sessions · tool calls · code changes · deploys', { size: 10, color: C.soft }))
  t.push(mono(ox + 356, oy - h + 98, 'consent · DSAR · retention evidence', { size: 10, color: C.soft }))
  t.push(mono(ox + 356, oy - h + 122, 'Apache-2.0 · TS / Python / Go, byte-identical fixtures', { size: 10, color: C.accentStrong, weight: 500 }))
  // shared ground note
  t.push(mono(ox + 340, oy - 150, 'shared ground: tamper-evident,', { size: 10, color: C.muted }))
  t.push(mono(ox + 340, oy - 134, 'developer-first audit logging', { size: 10, color: C.muted }))
  // disambiguation footnote
  t.push(rect(960, top + 60, 240, 130, { fill: C.sunken, stroke: C.line }))
  t.push(eyebrow(976, top + 84, 'name collision', { color: C.seal, size: 10 }))
  t.push(mono(976, top + 106, 'auditkit.dev — audit-log', { size: 10, color: C.soft }))
  t.push(mono(976, top + 121, 'SDK (compared here)', { size: 10, color: C.soft }))
  t.push(mono(976, top + 143, 'auditkit.io — unrelated', { size: 10, color: C.muted }))
  t.push(mono(976, top + 158, 'SOC 2 scanner CLI,', { size: 10, color: C.muted }))
  t.push(mono(976, top + 173, 'Apache-licensed', { size: 10, color: C.muted }))
  return heroShell(
    'auditkit',
    'AuditKit vs Veritio',
    'Two hash-chained audit SDKs — one stops at classic app events, one also proves what AI agents did.',
    t.join(''),
  )
}

// ---------------------------------------------------------------------------
// OG cards (1200×630) — bold serif title, chain motif, one-line thesis.
// ---------------------------------------------------------------------------

function ogCard(slug, versus, thesis) {
  const W = 1200, H = 630
  const chainY = H - 150
  const links = []
  let lx = 72
  for (let i = 0; i < 4; i++) {
    links.push(rect(lx, chainY - 20, 190, 46, { fill: C.raised, stroke: i === 3 ? C.accent : C.line, sw: i === 3 ? 1.4 : 1 }))
    links.push(mono(lx + 14, chainY, `evt_${(4520 + i).toString()}`, { size: 12, color: C.ink, weight: 600 }))
    links.push(mono(lx + 14, chainY + 17, 'sha256:… links prev', { size: 10.5, color: C.muted }))
    if (i < 3) links.push(hline(lx + 190, lx + 214, chainY + 3, { stroke: C.accent, sw: 1.4 }))
    lx += 214
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.surface}"/>
  ${rect(1, 1, W - 2, H - 2, { stroke: C.lineStrong, sw: 2 })}
  ${eyebrow(72, 96, 'Veritio · open-source evidence layer', { size: 15 })}
  ${hline(72, W - 72, 118, { stroke: C.line })}
  ${serif(72, 218, `Veritio vs ${versus}`, { size: 76, ls: -1 })}
  ${mono(72, 274, thesis, { size: 17, color: C.soft })}
  ${links.join('')}
  ${verifyStampOg(986, chainY - 20)}
  ${hline(72, W - 72, H - 78, { stroke: C.line })}
  ${mono(72, H - 48, `getveritio.com/alternatives/${slug}`, { size: 14, color: C.accentStrong, weight: 500 })}
  ${mono(W - 72, H - 48, 'reviewed aug 2026', { size: 13, color: C.muted, anchor: 'end' })}
</svg>`
}

function verifyStampOg(x, y) {
  return [
    rect(x, y, 142, 46, { stroke: C.accentStrong, sw: 2 }),
    eyebrow(x + 14, y + 28, 'verified', { color: C.accentStrong, size: 13 }),
  ].join('')
}

// ---------------------------------------------------------------------------

const PAGES = [
  {
    slug: 'aws-cloudtrail',
    hero: heroCloudtrail,
    heroFile: 'aws-cloudtrail-vs-veritio-application-evidence.png',
    ogVersus: 'AWS CloudTrail',
    ogThesis: 'Control-plane logs for AWS. Application & agent evidence, anywhere.',
  },
  {
    slug: 'workos-audit-logs',
    hero: heroWorkos,
    heroFile: 'workos-audit-logs-vs-veritio-open-source-evidence.png',
    ogVersus: 'WorkOS Audit Logs',
    ogThesis: 'A hosted audit-log API you trust, or an open protocol anyone can verify.',
  },
  {
    slug: 'langfuse',
    hero: heroLangfuse,
    heroFile: 'langfuse-vs-veritio-llm-observability-vs-evidence.png',
    ogVersus: 'Langfuse',
    ogThesis: 'Observability asks why the model did it. Evidence proves who did what.',
  },
  {
    slug: 'diy-audit-tables',
    hero: heroDiy,
    heroFile: 'diy-audit-tables-vs-veritio-tamper-evident-chain.png',
    ogVersus: 'DIY audit tables',
    ogThesis: 'A mutable table can be rewritten silently. A hash chain breaks visibly.',
  },
  {
    slug: 'langsmith',
    hero: heroLangsmith,
    heroFile: 'langsmith-vs-veritio-tracing-vs-evidence.png',
    ogVersus: 'LangSmith',
    ogThesis: 'Tracing and evals improve the app. Evidence proves what it did.',
  },
  {
    slug: 'auditkit',
    hero: heroAuditkit,
    heroFile: 'auditkit-vs-veritio-audit-log-sdk.png',
    ogVersus: 'AuditKit',
    ogThesis: 'Two hash-chained audit SDKs — one also records AI-agent provenance.',
  },
]

const fontFiles = readdirSync(FONT_DIR)
  .filter((f) => f.endsWith('.ttf'))
  .map((f) => join(FONT_DIR, f))

function renderPng(svg, widthPx) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: widthPx },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: SERIF },
    background: C.surface,
  })
  return resvg.render().asPng()
}

for (const dir of [HERO_DIR, OG_DIR, SRC_DIR]) mkdirSync(dir, { recursive: true })

for (const page of PAGES) {
  const heroSvg = page.hero()
  const ogSvg = ogCard(page.slug, page.ogVersus, page.ogThesis)
  // Keep the SVG sources on disk for review/diffing; they are not shipped.
  writeFileSync(join(SRC_DIR, `${page.slug}-hero.svg`), heroSvg)
  writeFileSync(join(SRC_DIR, `${page.slug}-og.svg`), ogSvg)
  writeFileSync(join(HERO_DIR, page.heroFile), renderPng(heroSvg, HERO_W * 2))
  writeFileSync(join(OG_DIR, `${page.slug}.png`), renderPng(ogSvg, 1200))
  console.log(`rendered ${page.slug}`)
}
console.log('done')
