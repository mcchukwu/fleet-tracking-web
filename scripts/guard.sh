#!/usr/bin/env bash
# Fails on design-system and code-quality violations. Add "guard-ignore" on a line to exempt it (explain why).
set -u
target="${1:-src}"
fail=0
check() { # name pattern
  local out
  out=$(rg -n --no-heading \
        --glob '!**/*.test.*' --glob '!**/__fixtures__/**' --glob '!src/styles/tokens.css' \
        --glob '!src/api/generated/**' "$2" "$target" | rg -v 'guard-ignore')
  if [ -n "$out" ]; then echo "GUARD FAIL: $1"; echo "$out"; fail=1; fi
}
check "arbitrary Tailwind value"  '\b(w|h|p|m|px|py|pt|pb|pl|pr|gap|text|bg|border|top|left|right|bottom|z|min-w|max-w|min-h|max-h|rounded|shadow)-\['
check "raw palette class"         '\b(bg|text|border|ring|fill|stroke|from|to|via)-(zinc|gray|slate|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b'
check "hex colour in source"      '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b'
check "inline style"              'style=\{\{'
check "direct web storage"        '\b(localStorage|sessionStorage)\b'
check "gradient"                  'gradient'
check "viewport unit"             'min-h-screen|\bh-screen\b|\b100vh\b|\b100vw\b'
check "default export"            '^export default'
pending=$(rg -n --no-heading --glob '!src/api/useQueryView.ts' --glob '!**/*.test.*' \
      '\.isPending\b' "$target" | rg -v 'guard-ignore')
if [ -n "$pending" ]; then echo "GUARD FAIL: query isPending outside useQueryView"; echo "$pending"; fail=1; fi
zout=$(rg -n --no-heading \
      --glob '!**/*.test.*' --glob '!**/__fixtures__/**' --glob '!src/ui/layers.css' \
      '\bz-(\[[^]]*\]|[0-9]+)\b|z-index\s*:|zIndex\s*:' "$target" | rg -v 'guard-ignore')
if [ -n "$zout" ]; then echo "GUARD FAIL: numeric or arbitrary z-index outside src/ui/layers.css"; echo "$zout"; fail=1; fi
sdk=$(rg -n --no-heading --glob '!src/map/providers/**' --glob '!**/*.test.*' \
      "from ['\"](maplibre-gl|pmtiles|terra-draw|@googlemaps/|@protomaps/basemaps)|google\.maps\." "$target" | rg -v 'guard-ignore')
mutate=$(rg -n --no-heading --glob '!src/auth/useCanMutate.ts' --glob '!**/*.test.*' \
      "useCan\(['\"](mutate|ack)['\"]\)" "$target" | rg -v 'guard-ignore')
if [ -n "$mutate" ]; then echo "GUARD FAIL: mutating capability outside useCanMutate"; echo "$mutate"; fail=1; fi
online=$(rg -n --no-heading --glob '!src/stores/connection.ts' --glob '!**/*.test.*' \
      "navigator\.onLine" "$target" | rg -v 'guard-ignore')
if [ -n "$online" ]; then echo "GUARD FAIL: navigator.onLine outside the connection store"; echo "$online"; fail=1; fi
exit $fail
