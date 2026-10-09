#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js LTS from https://nodejs.org, then open this launcher again."
else
  node scripts/local.mjs
fi
read -k 1 "?Press any key to close this window."
