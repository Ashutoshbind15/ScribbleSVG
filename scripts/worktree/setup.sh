#!/usr/bin/env bash
set -euo pipefail

# Hooks provide JSON on stdin; do not pass it to pnpm.
if [[ ! -t 0 ]]; then cat >/dev/null; fi
primary=$(git worktree list --porcelain | awk '/^worktree / {sub(/^worktree /, ""); print; exit}')
if [[ "$(pwd -P)" == "$(cd "$primary" && pwd -P)" ]]; then
  echo '[worktree-setup] refusing to run in the primary checkout' >&2
  exit 1
fi
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @scribblesvg/core --filter @scribblesvg/react-utils build
