---
title: Claude Code
description: Install the published Claude Code adapter, configure every supported hook, inspect local evidence, and understand retry and privacy boundaries.
audience: [developer, operator]
kind: guide
searchIntent: Configure the published Claude Code adapter for minimized local capture, MCP query, and optional ingest.
questions:
  - How do I install and configure the Veritio Claude Code adapter?
  - Which Claude Code hook events are captured?
  - How does local spooling behave during ingest outages?
lastUpdated: 2026-08-23
verifiedAgainst: ['@veritio/claude-code@0.4.7', '@veritio/core@0.4.7', '@veritio/storage@0.4.7']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/claude-code
  - https://www.npmjs.com/package/@veritio/claude-code/v/0.4.7
claimRefs: []
---

The published adapter captures Claude Code through out-of-band hooks. Every invocation writes minimized evidence to the local file store first; an optional ingest target receives the same redacted event and edge inputs.

## Install

The adapter runs its published hook with Bun:

```sh
bun add --dev @veritio/claude-code@0.4.7
```

The package pins compatible `@veritio/core@0.4.7` and `@veritio/storage@0.4.7` releases.

## Register all supported hooks

Add this to the repository's `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "PreToolUse": [{ "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "PostToolUseFailure": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/node_modules/@veritio/claude-code/dist/hook.js" }] }]
  }
}
```

Review the file before enabling it. `${CLAUDE_PROJECT_DIR}` is expanded by Claude Code at runtime; do not replace it with an untrusted path from hook input.

## Configure the process boundary

| Variable | Default | Responsibility |
| --- | --- | --- |
| `VERITIO_LOCAL_DIR` | `~/.veritio/claude-code` | Always-written local evidence directory |
| `VERITIO_TENANT_ID` | `local` | Tenant on every record |
| `VERITIO_ACTOR_ID` | `local_developer` | Stable enforcing-human ID |
| `VERITIO_AGENT_ACTOR_ID` | `agent_claude_code` | Stable agent ID |
| `VERITIO_ENVIRONMENT` | `development` | Environment scope |
| `VERITIO_WORKSPACE_ID` | unset | Optional workspace scope |
| `VERITIO_INGEST_URL` and `VERITIO_INGEST_KEY` | unset | Optional secondary delivery target; both required |
| `VERITIO_INGEST_TIMEOUT_MS` | `10000` | Upper bound for one ingest POST. Must be an integer from 1 to 30000; values above the ceiling throw at startup |
| `VERITIO_SPOOL_HARD_BATCHES` | `250` | Hard ceiling on queued delivery batches |
| `VERITIO_SPOOL_HARD_BYTES` | `50000000` | Hard ceiling on queued delivery bytes |

Keep secrets in the host's secret manager or shell environment, never in `.claude/settings.json` or repository files.

## What is captured

- `SessionStart`: session event and link to the enforcing human.
- `UserPromptSubmit`: prompt hash only.
- `PreToolUse`: pre-image content hash cached for matching edit completion.
- `PostToolUse` / failure: tool outcome plus before/after hashes for supported edits.
- `Stop`: git-status scan for Bash-driven file changes missed by edit hooks.
- `SessionEnd`: final per-session state.

Raw prompts, tool inputs, commands, MCP arguments, file content, and diffs are not persisted by the adapter.

## Outages and backpressure

The local store is written before optional ship-out. The durable queue lives under `<localDir>/spool/` with `pending`, `held`, and `quarantine` states, and remote delivery has three outcomes:

- **`retry`** — transport failures, `429`, and legacy `5xx` responses stay in the pending queue.
- **`pause`** — an explicit server pause (including recognized legacy quota codes) opens a sticky circuit and moves the whole queue to held. Later hooks append locally and make **zero** remote attempts.
- **`reject`** — permanent failures move to quarantine with the redacted payload intact. They are never silently deleted.

Ordinary hook invocations **never replay a backlog**. Recovery requires a separate operator command, and every replay epoch is bounded by batches, records, encoded bytes, and elapsed time — so an endpoint recovery or quota upgrade cannot turn routine hooks into an uncontrolled egress drain.

The hard ceiling is 250 batches or 50 MB (`VERITIO_SPOOL_HARD_BATCHES` / `VERITIO_SPOOL_HARD_BYTES`). At the ceiling, **existing entries are retained**, pending entries move to held, and the **newest** remote-delivery copy is refused with a visible stderr signal — evidence already captured is never dropped to make room. The hook exits `0`, so capture is deliberately fail-open for the coding session.

Local evidence may exist even when the hosted destination is behind. Inspect and control delivery with the operator CLI shipped in this package:

```sh
veritio-claude-code-spool status
veritio-claude-code-spool pause --reason "provider transfer alarm"
veritio-claude-code-spool quarantine
```

## Query through MCP

Register the read-only MCP server against the same directory:

```json
{
  "mcpServers": {
    "veritio-provenance": {
      "command": "bun",
      "args": ["/absolute/path/node_modules/@veritio/claude-code/dist/mcp.js"]
    }
  }
}
```

It exposes `veritio.list_sessions`, `veritio.get_session`, and `veritio.export_session`. Start with a test repository, inspect one session, and verify the exported bundle before enabling optional remote delivery.

For the event model and privacy checklist, read [Agent events](/docs/ai/agent-events/).
