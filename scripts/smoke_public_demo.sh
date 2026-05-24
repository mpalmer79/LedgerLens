#!/usr/bin/env bash
# Public-demo smoke check for the Railway deploy.
#
# Exits non-zero on the first failure. Designed to be the post-deploy
# verification step the Phase 1 audit said was missing — `/health`
# alone proves the API process is up, NOT that the demo is usable.
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://ledgerlens.up.railway.app}"
BACKEND_URL="${BACKEND_URL:-https://ledgerlens-backend-production.up.railway.app}"
TIMEOUT="${TIMEOUT:-15}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

check_status() {
    local label="$1" url="$2" expected="${3:-200}"
    local status
    status=$(curl --silent --show-error --max-time "$TIMEOUT" \
        --output /dev/null --write-out "%{http_code}" "$url" || echo "000")
    if [[ "$status" == "$expected" ]]; then
        green "  ✓ $label  ($status)"
    else
        red "  ✗ $label  expected $expected, got $status"
        red "    URL: $url"
        exit 1
    fi
}

check_json_field() {
    local label="$1" url="$2" jq_filter="$3" expected="$4"
    local body
    body=$(curl --silent --show-error --max-time "$TIMEOUT" "$url" || echo "{}")
    local actual
    actual=$(printf '%s' "$body" | python3 -c \
        "import json, sys; d=json.load(sys.stdin); print(eval('d$jq_filter'))" \
        2>/dev/null || echo "(parse error)")
    if [[ "$actual" == "$expected" ]]; then
        green "  ✓ $label  (=$actual)"
    else
        red "  ✗ $label  expected $expected, got $actual"
        exit 1
    fi
}

check_cors_preflight() {
    local label="$1" backend="$2" origin="$3"
    local headers
    headers=$(curl --silent --show-error --max-time "$TIMEOUT" -I -X OPTIONS \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: GET" \
        "$backend/health" || echo "")
    if printf '%s' "$headers" | grep -qiE "^access-control-allow-origin:.*($origin|\*)"; then
        green "  ✓ $label  (origin reflected)"
    else
        red "  ✗ $label  preflight did not reflect $origin"
        red "    Got headers:"
        printf '%s' "$headers" | sed 's/^/      /'
        exit 1
    fi
}

echo "LedgerLens public-demo smoke"
echo "  FRONTEND_URL=$FRONTEND_URL"
echo "  BACKEND_URL=$BACKEND_URL"
echo
yellow "Backend health endpoints"
check_status "GET $BACKEND_URL/health" "$BACKEND_URL/health" 200
check_status "GET $BACKEND_URL/ready" "$BACKEND_URL/ready" 200
check_status "GET $BACKEND_URL/demo/ready" "$BACKEND_URL/demo/ready" 200
# /demo/status may legitimately return 503 during a partial outage —
# accept either 200 or 503 as a non-crash signal.
status=$(curl --silent --max-time "$TIMEOUT" --output /dev/null \
    --write-out "%{http_code}" "$BACKEND_URL/demo/status" || echo "000")
if [[ "$status" == "200" || "$status" == "503" ]]; then
    green "  ✓ GET $BACKEND_URL/demo/status  ($status)"
else
    red "  ✗ GET $BACKEND_URL/demo/status  expected 200 or 503, got $status"
    exit 1
fi

echo
yellow "Backend readiness fields"
check_json_field "/demo/ready ready=true" \
    "$BACKEND_URL/demo/ready" "['ready']" "True"
check_json_field "/ready ready=true" \
    "$BACKEND_URL/ready" "['ready']" "True"

echo
yellow "Frontend pages"
check_status "GET $FRONTEND_URL/" "$FRONTEND_URL/" 200
check_status "GET $FRONTEND_URL/app" "$FRONTEND_URL/app" 200
check_status "GET $FRONTEND_URL/demo" "$FRONTEND_URL/demo" 200

echo
yellow "CORS preflight"
check_cors_preflight "frontend → backend" "$BACKEND_URL" "$FRONTEND_URL"

echo
green "All smoke checks passed."
