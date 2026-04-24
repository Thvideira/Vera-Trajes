#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  echo "==> Installing dependencies (backend)..."
  (cd "$ROOT/backend" && npm ci)
  echo "==> Installing dependencies (frontend)..."
  (cd "$ROOT/frontend" && npm ci)
else
  echo "==> SKIP_INSTALL=1: skipping npm ci"
fi

echo "==> Building backend..."
(cd "$ROOT/backend" && npm run build)

echo "==> Building frontend..."
(cd "$ROOT/frontend" && npm run build)

echo "==> Build finished (backend: dist/, frontend: dist/)."
