#!/usr/bin/env sh
set -eu
git config core.hooksPath .githooks
if [ -f "scripts/install-secrets-tooling.sh" ]; then
  sh scripts/install-secrets-tooling.sh
fi
echo "Configured core.hooksPath to .githooks and checked secrets tooling dependencies."
echo "Skipped Vercel local link. CI links Vercel and syncs env vars during preview and production deploys."
echo "Do not run vercel env pull, vercel dev, or vercel deploy locally."
