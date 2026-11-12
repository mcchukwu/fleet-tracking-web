#!/usr/bin/env bash
# Fails a build that claims an offline map without shipping its pack and assets.
set -euo pipefail

url="${VITE_MAP_PMTILES_URL:-}"
if [ -z "$url" ]; then
  echo "map pack: none configured (map is online-only)"
  exit 0
fi
if [[ "$url" != /* ]]; then
  echo "map pack: remote URL configured, skipping local asset check"
  exit 0
fi

pack="public${url}"
if [ ! -s "$pack" ]; then
  echo "map pack: missing $pack" >&2
  exit 1
fi
for asset in "public/map/fonts/Noto Sans Regular/0-255.pbf" "public/map/sprites/light.json" "public/map/sprites/dark.json"; do
  if [ ! -s "$asset" ]; then
    echo "map pack: missing $asset" >&2
    exit 1
  fi
done
echo "map pack: $(du -h "$pack" | cut -f1) at $pack, glyphs and sprites present"
