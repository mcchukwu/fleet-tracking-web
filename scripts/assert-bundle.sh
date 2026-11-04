#!/usr/bin/env bash
# Fails when staging demo credentials reach the production bundle.
set -u
if [ ! -d dist ]; then
  echo "BUNDLE FAIL: dist/ is missing; run vite build first" >&2
  exit 1
fi
if rg -n "DemoPass123!|@demo\.ftb" dist; then
  echo "BUNDLE FAIL: demo credentials found in dist" >&2
  exit 1
fi
echo "assert-bundle: no demo credentials in dist"
