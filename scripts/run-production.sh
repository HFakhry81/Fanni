#!/usr/bin/env bash
# Production startup wrapper for the API server.
#
# Starts the server, waits for it to become healthy, then runs the OTP smoke
# test against it. If the smoke test fails, the server is killed and the
# deployment exits with a non-zero code — surfacing the failure in deploy logs
# and preventing a misconfigured build from going live.
#
# This script IS the production run command (see artifact.toml).

set -euo pipefail

PORT="${PORT:-8080}"
BASE_URL="http://localhost:${PORT}"
SERVER_BIN="node --enable-source-maps artifacts/api-server/dist/index.mjs"

# ── Start the API server in the background ─────────────────────────────────
echo "[deploy] Starting API server on port ${PORT}..."
# shellcheck disable=SC2086
$SERVER_BIN &
SERVER_PID=$!

cleanup() {
  echo "[deploy] Stopping API server (pid ${SERVER_PID})..."
  kill "${SERVER_PID}" 2>/dev/null || true
}
trap cleanup EXIT

# ── Wait for the server to become healthy (up to 30 s) ────────────────────
echo "[deploy] Waiting for server to become healthy..."
for i in $(seq 1 30); do
  if curl -sf "${BASE_URL}/api/healthz" > /dev/null 2>&1; then
    echo "[deploy] Server healthy after ${i}s"
    break
  fi
  if [ "${i}" -eq 30 ]; then
    echo "[deploy] ERROR: Server did not become healthy within 30 s — aborting"
    exit 1
  fi
  sleep 1
done

# ── OTP smoke test ─────────────────────────────────────────────────────────
echo "[deploy] Running OTP enforcement smoke test..."
if bash scripts/smoke-test-otp.sh "${BASE_URL}"; then
  echo "[deploy] OTP smoke test PASSED — deployment is good"
else
  echo "[deploy] OTP smoke test FAILED — aborting deployment"
  exit 1
fi

# ── Hand off to the server (keep the container alive) ─────────────────────
echo "[deploy] Handing off to API server process..."
trap - EXIT   # clear the cleanup trap so we don't kill on normal exit
wait "${SERVER_PID}"
