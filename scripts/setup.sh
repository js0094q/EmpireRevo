#!/usr/bin/env bash
set -euo pipefail

# EmpirePicks local setup
# Usage:
#   bash scripts/setup.sh
#
# What it does:
# - checks prerequisites
# - installs deps
# - creates .env.local if missing
# - runs typecheck/lint
# - starts dev server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> EmpirePicks setup"
echo "Repo: $ROOT_DIR"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing required command: $1" >&2
    exit 1
  }
}

need_cmd node
need_cmd npm
need_cmd git

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "ERROR: Node 20+ required. Current: $(node -v)" >&2
  exit 1
fi

echo "==> Installing dependencies"
npm ci

if [[ ! -f ".env.local" ]]; then
  echo "==> Creating .env.local (placeholder)"
  cat > .env.local <<'ENVEOF'
# Server-only secret used by /api/* route handlers
ODDS_API_KEY=

# Optional: set default league for local dev
NEXT_PUBLIC_DEFAULT_LEAGUE=nfl
ENVEOF
  echo "Created .env.local. Add ODDS_API_KEY before expecting live odds."
else
  echo "==> .env.local already exists"
fi

echo "==> Running checks"
npm run -s typecheck || { echo "Typecheck failed"; exit 1; }
npm run -s lint || { echo "Lint failed"; exit 1; }

echo "==> Starting dev server"
echo "Open: http://localhost:3000"
npm run dev
