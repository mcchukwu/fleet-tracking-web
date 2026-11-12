#!/usr/bin/env bash
# Extracts the regional Protomaps pack (or the small test pack) with the Go CLI.
set -euo pipefail

BIN="${PMTILES_BIN:-}"
if [ -z "$BIN" ]; then
  if command -v pmtiles >/dev/null 2>&1; then BIN="$(command -v pmtiles)"
  elif command -v go-pmtiles >/dev/null 2>&1; then BIN="$(command -v go-pmtiles)"
  else BIN="$(go env GOPATH)/bin/go-pmtiles"; fi
fi
SOURCE="${PMTILES_SOURCE:-https://build.protomaps.com/20261111.pmtiles}"

if [ "${1:-}" = "--test" ]; then
  OUT="public/map/test.pmtiles"
  BBOX="2.4,4.2,5.2,8.6"
  MAXZOOM="6"
else
  OUT="public/map/fleet.pmtiles"
  BBOX="2.4,4.2,5.2,8.6"
  MAXZOOM="12"
fi

mkdir -p "$(dirname "$OUT")"
"$BIN" extract "$SOURCE" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"
ls -lh "$OUT"
