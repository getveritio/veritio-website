# Veritio Website Repository Spec

## Mission

`veritio-website` is the public website and documentation surface for
getveritio.com. It explains Veritio clearly to developers, compliance teams, and
governance stakeholders without turning product claims into legal guarantees.

## Owns

- `src/pages/`: public pages and docs routes.
- `src/layouts/`: shared Astro page chrome.
- `public/`: static public assets safe to publish.
- `astro.config.mjs`: Astro site configuration.
- `docs/`: website repository routing and publishing specs.
- `.codex/agents/`: project-scoped reviewers for Astro/site quality, public
  claims, and repo routing.

## Does Not Own

- Protocol semantics, SDK behavior, event schemas, canonical JSON, hashing,
  redaction, export manifests, or conformance fixtures.
- Hosted SaaS/PaaS implementation, private dashboards, billing, hosted regions,
  private jobs, customer portals, or operational runbooks.
- Private customer data, private screenshots, unreleased pricing commitments,
  or internal incident/process docs.

## Edit Routing

| Change | Repository |
| --- | --- |
| Landing page, docs page, SEO metadata, public product explanation | `veritio-website` |
| Public examples shown on the website | `veritio-website`, backed by `veritio` APIs |
| New protocol field, SDK behavior, verifier/export change | `veritio` |
| Hosted ingest, hosted MCP, billing, Workbench, customer portal, region behavior | `veritio-cloud` |

## Claims Policy

Public copy may say Veritio supports evidence workflows, audit trails, records
of processing support, data subject workflows, governance review, verification,
and export preparation. It must not claim automatic GDPR, PIPA, CCPA, SOC 2,
HIPAA, DORA, NIS2, or other legal compliance.

Do not publish a claim unless one of these is true:

- the feature exists in `veritio`
- the feature exists in `veritio-cloud`
- the copy clearly marks it as planned or conceptual

## Handoff Contract

If a website task needs an unimplemented product capability, stop and identify
the owning repo. Define portable behavior in `veritio` first when it changes
the public contract. Implement managed behavior in `veritio-cloud` before
making strong public claims here.

For multi-repo work, prefer coordination from the `veritio` control repo using
explicit sibling paths and `bun run verify:split`. Do not require separate
user-controlled chats just because this repo owns the public website files.

## Verification

Run `bun run check` and `bun run build` before claiming done for site changes.
