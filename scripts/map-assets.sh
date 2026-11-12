#!/usr/bin/env bash
# Downloads the Protomaps glyph ranges and sprites the local style uses.
set -euo pipefail

BASE="https://raw.githubusercontent.com/protomaps/basemaps-assets/main"
OUT="public/map"
RANGES=(0-255 256-511 512-767 768-1023 1024-1279 1280-1535 1536-1791 1792-2047)
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

for font in "${FONTS[@]}"; do
  dir="$OUT/fonts/$font"
  mkdir -p "$dir"
  for range in "${RANGES[@]}"; do
    file="$dir/$range.pbf"
    if [ ! -s "$file" ]; then
      encoded="${font// /%20}"
      curl --fail --silent --show-error --location "$BASE/fonts/$encoded/$range.pbf" --output "$file"
    fi
  done
done

mkdir -p "$OUT/sprites"
for theme in light dark; do
  for suffix in .json .png @2x.json @2x.png; do
    file="$OUT/sprites/$theme$suffix"
    if [ ! -s "$file" ]; then
      curl --fail --silent --show-error --location "$BASE/sprites/v4/$theme$suffix" --output "$file"
    fi
  done
done

du -sh "$OUT/fonts" "$OUT/sprites"
