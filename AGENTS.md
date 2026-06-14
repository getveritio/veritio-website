# AGENTS.md - Veritio Website

This repository is the public website and documentation surface for Veritio at
getveritio.com.

## Product Rules

- Veritio is not legal advice and must not claim automatic GDPR, PIPA, CCPA,
  SOC 2, HIPAA, DORA, NIS2, or other compliance.
- Prefer "evidence support", "audit trail", "records of processing support",
  "data subject workflow", "evidence graph", and "verification" over
  "guaranteed compliance".
- Keep public copy plain, specific, and developer/governance friendly.
- Do not publish hosted-provider internals, private roadmap claims, customer
  secrets, operational runbooks, or unreleased pricing commitments.

## Repository Boundary

- This repo owns public marketing pages, docs pages, examples, SEO metadata,
  and static assets.
- The OSS protocol/SDK repo is `veritio`.
- The private hosted SaaS/PaaS repo is `veritio-cloud`.
- If a claim depends on an SDK, protocol, or hosted feature, verify that the
  source repo actually supports it before publishing.
- Read any local hidden execution specs under `.codex/private/specs/` when
  present. Those files are intentionally ignored and must not be committed.
- Route sibling work with the inline boundaries in this file before changing
  website structure, public claims, examples, docs routes, or ownership.
- Cross-repo work should normally be coordinated from the `veritio` control
  repo, not by asking the user to manage separate chats.

## Engineering Rules

- Use Astro for the website.
- Keep pages fast, accessible, and mostly static by default.
- Do not add client JavaScript unless a page genuinely needs interaction.
- Do not import private cloud code or depend on unpublished hosted internals.
- Public examples should use stable OSS packages or clearly marked planned APIs.

## Codex Setup

- Repo-local Codex hooks live in `.codex/hooks/`.
- Codex reviewer agents live in `.codex/agents/`.
- Use `astro-site-reviewer` for Astro, accessibility, SEO, and build-surface
  changes.
- Use `public-claims-reviewer` for marketing/docs copy and compliance-safe
  product claims.
- Use `repo-routing-reviewer` when a change could belong in `veritio` or
  `veritio-cloud`.

## Split Routing

- `veritio`: public protocol, schemas, SDKs, framework adapters, storage
  helpers, self-hosted server modules, verifier, export format, conformance
  fixtures, and public examples.
- `veritio-website`: public Astro website, docs pages, SEO metadata, marketing
  copy, public examples, and static assets.
- `veritio-cloud`: private hosted SaaS/PaaS implementation, hosted ingest,
  hosted MCP, managed storage, billing, regions, customer portals, admin, and
  operational jobs.
- Public claims here must wait until backing OSS or hosted behavior exists.

## Commands

- Install: `bun install`
- Dev: `bun run dev`
- Build: `bun run build`
- Check: `bun run check`
