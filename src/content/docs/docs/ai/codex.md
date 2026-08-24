---
title: Codex
description: Build the experimental Codex notify adapter from the pinned OSS source and capture hash-only turn evidence without replacing an existing notifier.
audience: [developer, operator]
kind: guide
searchIntent: Build and configure the experimental Codex notify adapter for local hash-only evidence capture.
questions:
  - What Codex activity can the current Veritio adapter capture?
  - How do I preserve an existing Codex notify command?
  - Which tool and file evidence is unavailable from the notify payload?
lastUpdated: 2026-08-23
verifiedAgainst: ['Codex adapter source at veritio@c4100ee']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/adapters/codex
claimRefs: []
---

The current Codex adapter is experimental and source-backed. It maps the CLI's `agent-turn-complete` notify payload into a session-start event and a prompt event containing only a prompt hash. The notify surface does not expose tool calls or file edits, so this is **not** full execution provenance.

## Build the pinned source

No published-package installation is asserted by this guide. Build the adapter from the verified revision:

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
bun run --cwd adapters/codex build
bun run --cwd adapters/codex test
```

The executable is `adapters/codex/dist/notify.js`. Create an explicit wrapper using its absolute path.

## Preserve the single notify slot

Codex supports one `notify` command. If one already exists, the wrapper must invoke both; replacing it would silently break the existing behavior.

```bash
#!/bin/bash

# Preserve your current notifier when present.
# /absolute/path/to/existing-notifier "$@" || true

nohup bun /absolute/path/to/veritio/adapters/codex/dist/notify.js "$@" \
  >/dev/null 2>&1 &
```

Make the wrapper executable, then reference it in `~/.codex/config.toml`:

```toml
notify = ["/absolute/path/to/veritio-codex-notify-wrapper.sh"]
```

The wrapper backgrounds capture because the adapter is designed never to block a completed Codex turn.

## Configuration

The adapter uses the same host variables as the Claude Code integration: `VERITIO_LOCAL_DIR` defaults to `~/.veritio/codex`; tenant, human actor, agent actor, environment, and optional workspace IDs are explicit. Setting both `VERITIO_INGEST_URL` and `VERITIO_INGEST_KEY` enables optional ship-out with a default 10-second timeout.

Keep those values in the launch environment used by Codex. A GUI-launched process may not inherit the variables from an interactive shell, so confirm the local directory receives records before assuming capture works.

## Exact capture boundary

| Available from notify | Recorded form |
| --- | --- |
| turn ID | hashed into stable `codex_<16 hex>` session ID |
| input messages | joined and stored only as a SHA-256 digest |
| completion time | host timestamp on both events |
| model identity | generic `openai` / `codex`, because notify omits the exact model |

Tool calls, command arguments, approvals, changed files, diffs, tests, and deployment outcomes are unavailable from this notify payload. The adapter must not invent them. Capture those through a separately reviewed git scan or CI/deployment integration and link the resulting entities with the public provenance API.

## Verification

1. Run the adapter tests before installing the wrapper.
2. Complete a non-sensitive test turn.
3. Confirm the local directory contains `events.jsonl`, `edges.jsonl`, and `commits.jsonl` as applicable.
4. Inspect the stored events and assert the prompt text is absent.
5. Re-deliver the same fixture notification and confirm deterministic replay rather than a second logical session.
6. Stop the optional ingest target and confirm local capture still succeeds within the timeout bound.

For richer lifecycle capture and the trust model, continue with [Agent events](/docs/ai/agent-events/).
