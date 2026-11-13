# Approved Dependencies

Only the following dependencies are approved.

## Core

react
@tanstack/react-query
@tanstack/react-router
@tanstack/react-virtual
zustand
zod
react-hook-form
@hookform/resolvers

## Mapping

maplibre-gl
pmtiles
@protomaps/basemaps
terra-draw
@googlemaps/js-api-loader

Restrictions:

- terra-draw MapLibre adapter is approved.
- Other terra-draw adapters are restricted to Slice 15.
- `@protomaps/basemaps` is only imported by `src/map/providers/**` (guard-enforced).
- `vite-plugin-pwa` and the Workbox family (`workbox-range-requests`) are the approved offline build tooling.
- @googlemaps/js-api-loader is approved for Slice 15 only.

## UI

lucide-react
class-variance-authority
clsx
tailwind-merge
@radix-ui/*

## Fonts

@fontsource-variable/inter
@fontsource-variable/jetbrains-mono

## Data and Offline

papaparse
idb-keyval
vite-plugin-pwa
workbox

## Testing

vitest
@testing-library/*
msw
@playwright/test
@axe-core/playwright

## API and Tooling

openapi-typescript
oxlint
oxlint-tsgolint
prettier
prettier-plugin-tailwindcss
ripgrep (development tool)
wrangler (deployment tool)

Anything not listed requires approval before installation.
Do not install alternative packages without approval.
