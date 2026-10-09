#!/usr/bin/env sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js LTS from https://nodejs.org, then run this launcher again."
  exit 1
fi
exec node scripts/local.mjs
