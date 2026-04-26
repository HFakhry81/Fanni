#!/bin/bash
set -e
pnpm install --frozen-lockfile

pnpm --filter @workspace/api-server exec tsx migrations/008-add-location-centroid.ts

pnpm --filter @workspace/api-server exec tsx migrations/009-reseed-locations.ts

pnpm --filter db push

# ── OTP smoke test (secondary, post-merge check) ─────────────────────────────
# PRIMARY enforcement: scripts/run-production.sh runs the same smoke test
# unconditionally on every production deploy (against localhost). That script
# is the authoritative gate — it always blocks a bad deploy.
#
# This secondary check runs the smoke test against the *public* production URL
# after a merge, which additionally validates ingress/proxy behaviour and gives
# earlier feedback before the next deploy rolls out.
#
# Configuration (optional — set once in Replit Secrets):
#   SMOKE_TEST_URL=https://your-app.replit.app
#
# Behaviour:
#   SMOKE_TEST_URL set   → smoke test runs; non-zero exit fails this script
#   SMOKE_TEST_URL unset → check is skipped; deployment is still protected by
#                          the production run-wrapper (scripts/run-production.sh)
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "${SMOKE_TEST_URL:-}" ]; then
  echo ""
  echo "=== OTP smoke test (post-merge, public URL): ${SMOKE_TEST_URL} ==="
  bash scripts/smoke-test-otp.sh "${SMOKE_TEST_URL}"
  echo "=== OTP smoke test: PASSED ==="
else
  echo ""
  echo "OTP smoke test (post-merge): skipped — SMOKE_TEST_URL not set."
  echo "  Production deployments are still protected by scripts/run-production.sh."
  echo "  To also verify the public URL after each merge, add:"
  echo "    SMOKE_TEST_URL=https://your-app.replit.app"
  echo "  to your Replit Secrets."
fi
