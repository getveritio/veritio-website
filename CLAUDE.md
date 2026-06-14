# CLAUDE.md - Veritio Website

**Authority:** Follow this file, root `AGENTS.md`, and explicit user direction.

This repo is the Astro public website for Veritio.

Read any local hidden execution specs under `.codex/private/specs/` when
present. Those files are intentionally ignored and must not be committed. Use
the split boundaries in this file before changing product claims, docs
structure, examples, or anything that may belong in a sibling repo.

## Operating Mode

- Verify product claims against the OSS `veritio` repo or explicit hosted docs
  before publishing.
- Keep copy clear that Veritio provides evidence support, not legal compliance
  guarantees.
- Preserve the split: website here, OSS SDK/protocol in `veritio`, hosted
  SaaS/PaaS in `veritio-cloud`.
- Prefer concrete product language over generic compliance or AI hype.
- Do not publish internal product specs, execution prompts, roadmap details, or
  private orchestration notes in public docs.

## Split Routing

- `veritio`: public protocol, schemas, SDKs, framework adapters, storage
  helpers, self-hosted server modules, verifier, export format, conformance
  fixtures, and public examples.
- `veritio-website`: public Astro website, docs pages, SEO metadata, marketing
  copy, public examples, and static assets.
- `veritio-cloud`: private hosted SaaS/PaaS implementation, hosted ingest,
  hosted MCP, managed storage, billing, regions, customer portals, admin, and
  operational jobs.
- Publish website claims only after backing OSS or hosted behavior exists.

## Non-Negotiables

- No automatic compliance claims.
- No private SaaS/PaaS internals in public pages.
- No customer data, secrets, tokens, screenshots with sensitive data, or private
  operational details.
- Do not make the hosted product sound required for OSS SDK usage.

## Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run check`

## Codex / Agent Hooks

- Repo-local automation lives in `.codex/`.
- Before claiming done after code or asset changes, run `bun run check` and
  `bun run build`.
- Use `astro-site-reviewer` for UI/build changes and `public-claims-reviewer`
  for public copy changes.
- Use `repo-routing-reviewer` for cross-repo ownership checks.
