---
title: Local CLI
description: Run the source-backed Veritio Workbench and local MCP server with write tools disabled by default and no hosted account requirement.
audience: [developer, operator]
kind: guide
searchIntent: Run the source-backed Veritio local Workbench and MCP tools without depending on Cloud.
questions:
  - Which Veritio CLI commands are currently implemented?
  - How do I inspect local evidence from the command line?
  - Are local MCP write tools enabled by default?
lastUpdated: 2026-08-23
verifiedAgainst: ['Veritio CLI 0.1.1 at veritio@c4100ee']
sourceRefs:
  - https://github.com/getveritio/veritio/tree/c4100ee7b678d0c6b227c67ae6ea1d8a1f373967/cli
claimRefs: [cloud-projects-keys-ingest]
---

The Veritio CLI is source-backed at the verified revision. Its local Workbench path does not require a hosted account. The same source also implements offline export verification and an optional Cloud device-login flow.

## Build from the pinned source

```sh
git clone https://github.com/getveritio/veritio.git
git -C veritio checkout c4100ee7b678d0c6b227c67ae6ea1d8a1f373967
cd veritio
bun install --frozen-lockfile
bun run --cwd cli build
```

The package manifest names the binary `veritio`, but this documentation runs the built source explicitly because no package-registry release is claimed here.

## Local Workbench and MCP

```sh
node cli/dist/index.js dev --mcp --scenario
```

Expected startup lines:

```text
Veritio Workbench: http://127.0.0.1:4983
MCP endpoint: http://127.0.0.1:4983/mcp
MCP write tools: disabled
```

The local server binds to `127.0.0.1:4983` by default. `--scenario` seeds a local example. MCP write tools remain unavailable unless `--allow-write-tools` is passed explicitly.

| Option | Default | Effect |
| --- | --- | --- |
| `--mcp` | Required | Starts the local MCP-capable Workbench |
| `--host <host>` | `127.0.0.1` | Changes the bind host |
| `--port <port>` | `4983` | Changes the bind port |
| `--scenario` | Off | Seeds the local integration scenario |
| `--allow-write-tools` | Off | Exposes local MCP mutation tools |

Do not bind the development listener to a public interface. Leave write tools disabled unless the connecting client and local environment are explicitly trusted.

## Verify an export offline

```sh
node cli/dist/index.js verify-bundle ./evidence.vevb --json
```

Optional flags:

- `--public-key <path>` supplies an Ed25519 public key.
- `--require-signature` fails an otherwise intact unsigned bundle.
- `--json` prints the structured verification report.

The command exits `0` only when the report is valid. It checks structure, file integrity, declared chains, and signature status. Without a required verified signature, integrity does not establish who produced the bundle.

## Optional Cloud device login

```sh
node cli/dist/index.js login codex
node cli/dist/index.js login claude
node cli/dist/index.js login both --no-browser
```

This is an optional hosted path. The device flow requests an ingest-scoped credential after browser approval, writes credentials with mode `0600`, and configures the selected capture client. Do not paste credentials into prompts or commit the generated files.

Use [Agent events](/docs/ai/agent-events/) to decide what is safe to capture, and use the [export verifier reference](/docs/reference/verifier/) before relying on a bundle result.
