#!/usr/bin/env bash
# Fails when staging demo credentials reach the production bundle.
set -u
if [ ! -d dist ]; then
  echo "BUNDLE FAIL: dist/ is missing; run vite build first" >&2
  exit 1
fi
if command -v rg >/dev/null 2>&1; then
  hits=$(rg -n "DemoPass123!|@demo\.ftb" dist || true)
else
  hits=$(grep -rlIE "DemoPass123!|@demo\.ftb" dist || true)
fi
if [ -n "$hits" ]; then
  echo "$hits"
  echo "BUNDLE FAIL: demo credentials found in dist" >&2
  exit 1
fi
echo "assert-bundle: no demo credentials in dist"
