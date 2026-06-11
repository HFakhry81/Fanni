#!/usr/bin/env bash
# OTP enforcement smoke test
#
# Usage:
#   ./scripts/smoke-test-otp.sh [BASE_URL]
#
# Examples:
#   ./scripts/smoke-test-otp.sh                               # local dev server (http://localhost:8080)
#   ./scripts/smoke-test-otp.sh https://your-app.replit.app  # production
#
# What it checks:
#   1. GET  /api/config        — server reports otpEnabled=true
#   2. POST /api/auth/register — request without verificationToken is rejected
#                                with HTTP 400 AND an OTP-specific error message
#
# A 4xx from rate-limiting or unrelated validation is NOT counted as a pass;
# the response body must mention "verification" to confirm the OTP gate fired.
#
# Exit codes:
#   0  — all checks passed (OTP is enforced)
#   1  — one or more checks failed

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
PASS=0
FAIL=0

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

# Parse a boolean JSON field robustly: tries jq first, falls back to grep.
json_get_bool() {
  local json="$1" field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".${field} // \"false\""
  else
    if echo "$json" | grep -qE "\"${field}\"[[:space:]]*:[[:space:]]*true"; then
      echo "true"
    else
      echo "false"
    fi
  fi
}

echo ""
yellow "=== OTP Enforcement Smoke Test ==="
yellow "Target: $BASE_URL"
echo ""

# ── 1. Config endpoint ────────────────────────────────────────────────────────
echo "1) GET /api/config — server should report otpEnabled=true"
CONFIG_BODY=$(curl -sf -w '\n%{http_code}' "${BASE_URL}/api/config" 2>/dev/null) || {
  red "  ERROR  Could not reach ${BASE_URL}/api/config (is the server running?)"
  exit 1
}
CONFIG_JSON=$(echo "$CONFIG_BODY" | head -n -1)
OTP_VALUE=$(json_get_bool "$CONFIG_JSON" "otpEnabled")

if [ "$OTP_VALUE" = "true" ]; then
  green "  PASS  [config.otpEnabled] — server reports otpEnabled=true"
  PASS=$((PASS + 1))
else
  red "  FAIL  [config.otpEnabled] — otpEnabled is NOT true (got: $OTP_VALUE)"
  red "        body: $CONFIG_JSON"
  FAIL=$((FAIL + 1))
fi

echo ""

# ── 2. Register without verificationToken ─────────────────────────────────────
# Use a random mobile number (valid Egyptian format: 010/011/012/015 + 8 digits)
# to avoid rate-limit collisions across repeated runs.
RAND_SUFFIX=$(( RANDOM % 90000000 + 10000000 ))
TEST_MOBILE="010${RAND_SUFFIX}"

echo "2) POST /api/auth/register (no verificationToken) — expect HTTP 400 with OTP error"
echo "   (using mobile: $TEST_MOBILE to avoid rate-limit collisions)"
REG_STATUS=$(curl -s -o /tmp/smoke_reg_body.txt -w '%{http_code}' \
  -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SmokeTest User\",\"mobile\":\"${TEST_MOBILE}\",\"password\":\"Test@1234\",\"role\":\"client\"}")
REG_BODY=$(cat /tmp/smoke_reg_body.txt)

if [ "$REG_STATUS" -eq 400 ] && echo "$REG_BODY" | grep -qi "verification"; then
  green "  PASS  [register without OTP] — HTTP 400 with OTP-specific rejection"
  green "        body: $REG_BODY"
  PASS=$((PASS + 1))
elif [ "$REG_STATUS" -eq 400 ]; then
  red "  FAIL  [register without OTP] — HTTP 400 returned but body does NOT mention"
  red "        verification; OTP gate may not be the cause of the rejection"
  red "        body: $REG_BODY"
  FAIL=$((FAIL + 1))
elif [ "$REG_STATUS" -ge 400 ] && [ "$REG_STATUS" -le 499 ]; then
  red "  FAIL  [register without OTP] — HTTP $REG_STATUS (not 400) and body unclear;"
  red "        possible rate-limit or unrelated error — OTP gate not confirmed"
  red "        body: $REG_BODY"
  FAIL=$((FAIL + 1))
else
  red "  FAIL  [register without OTP] — expected 400, got HTTP $REG_STATUS (OTP not enforced)"
  red "        body: $REG_BODY"
  FAIL=$((FAIL + 1))
fi

echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "Results: $PASS passed, $FAIL failed"
echo ""
if [ "$FAIL" -eq 0 ]; then
  green "OTP enforcement is ACTIVE on $BASE_URL"
  echo ""
  echo "  To re-run after a future deploy:"
  echo "    ./scripts/smoke-test-otp.sh https://your-app.replit.app"
  exit 0
else
  red "OTP enforcement check FAILED on $BASE_URL — review output above"
  exit 1
fi
