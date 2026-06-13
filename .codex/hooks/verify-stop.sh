#!/usr/bin/env bash
set -euo pipefail

if [[ "${VERITIO_SKIP_VERIFY_HOOK:-}" == "1" ]]; then
  exit 0
fi

PROJECT_DIR="${CODEX_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [[ -z "$PROJECT_DIR" ]]; then
  if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    PROJECT_DIR="$git_root"
  else
    PROJECT_DIR="$PWD"
  fi
fi

cd "$PROJECT_DIR"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  UNTRACKED="$(git ls-files --others --exclude-standard)"

  if git diff --quiet && git diff --cached --quiet && [[ -z "$UNTRACKED" ]]; then
    exit 0
  fi

  CHANGED=$(
    {
      git diff --name-only
      git diff --cached --name-only
      printf '%s\n' "$UNTRACKED"
    } | sed '/^$/d' | sort -u
  )

  NON_DOC=$(printf '%s\n' "$CHANGED" | grep -Ev '(^|/)LICENSE(\..*)?$|\.(md|mdx|txt)$' || true)
  if [[ -z "$NON_DOC" ]]; then
    echo "verify-stop: only docs files changed; skipping website verification." >&2
    exit 0
  fi
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "verify-stop: bun not found; skipping website verification." >&2
  exit 0
fi

if [[ ! -d node_modules ]]; then
  echo "verify-stop: node_modules missing; run bun install first." >&2
  exit 1
fi

echo "verify-stop: running bun run check && bun run build." >&2
bun run check && bun run build
