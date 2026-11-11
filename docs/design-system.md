# Fleet Console Design System

Authoritative source for every visual and interaction decision in this app. If this file conflicts with `ui-brief.md`, **this file wins for appearance and interaction; `ui-brief.md` wins for which screens exist and what data they show.**

Agents: read §0 and §1 always. Read other sections only when building something they cover.

---

## 0. How to use this document

1. Never invent a colour, size, radius, shadow or duration. Use a token from §3 to §8.
2. Never use a Tailwind arbitrary value (`w-[313px]`, `text-[#333]`). If a needed value is missing, stop and propose a new token.
3. Build from the components in §10. If a component does not exist, compose it from existing ones before creating a new one.
4. Every list, panel and map layer implements the five states in §11.
5. Finish with the checklist in §17.

---

## 1. Principles (the reasons behind every rule)

The user is an operator watching a live system, often for hours, often under pressure when something goes wrong. That single fact produces the whole system:

| Principle | Why | What it forces |
|---|---|---|
| **Glanceable** | An operator scans, they do not read. | Status by colour *and* shape *and* label. Big numbers, small chrome. |
| **Calm** | Constant motion and colour cause fatigue and hide real alerts. | One accent colour, colour reserved for meaning, motion only when information changes. |
| **Honest** | A stale map that looks live is worse than no map. | Connection and data-age are always visible. Offline data is labelled with its age. |
| **Dense but legible** | More vehicles in view means fewer clicks. | 4px grid, compact rows, tabular numbers, no decorative padding. |
| **Keyboard-first** | Dispatchers repeat the same actions hundreds of times. | Every action reachable by keyboard, visible focus, shortcuts for the frequent ones. |
| **The map owns the page** | The map is the product. | Panels float over it, are opaque, are dismissible, and never shrink the map to a sliver. |
| **Minimal chrome** | Every persistent control takes map space away from the operator. | Show only what the current task needs; secondary and rare controls live in menus, popovers or sub-menus. Extend an existing menu before adding a new on-screen element. |

---

## 2. Stack and implementation rules

- Tailwind v4, tokens defined once in `src/styles/tokens.css` (§3 to §8) and exposed through `@theme inline`.
- Maps: features use `<FleetMap>` and the `MapAdapter` contract. Layers are provider-neutral, via `MapTokens`; only `src/map/providers/*` may import a map SDK.
- Primitives from shadcn/ui (Radix underneath). Restyle them to these tokens; do not leave default shadcn styling.
- Variants with `cva`, class merging with `cn()` (`clsx` + `tailwind-merge`).
- Icons: `lucide-react` only, 16px default, 1.5px stroke, always paired with a label or `aria-label`.
- Fonts are **self-hosted** (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`). The app must render correctly offline, so no Google Fonts and no CDN assets.
- Forms: React Hook Form with a Zod resolver.
- Use semantic utilities only: `bg-surface`, `text-muted`, `border-border`. Never `bg-zinc-100` or `text-gray-500` in feature code.
- Use real HTML: `<button>` for actions, `<a>` for navigation, `<table>` for tabular data, landmarks (`header`, `nav`, `main`, `aside`).
- Inline `style` is allowed only for values computed at runtime (marker position, rotation).

---

## 3. Colour

### 3.1 Tokens

Neutrals are the zinc scale. One accent. Status colours carry meaning and are used for nothing else.

```css
/* src/styles/tokens.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* Surfaces */
  --bg:            #fafafa;  /* app background behind panels */
  --surface:       #ffffff;  /* panels, drawers, tables */
  --surface-2:     #f4f4f5;  /* hover rows, inputs on surface, subtle fills */
  --surface-3:     #e4e4e7;  /* pressed, selected-neutral */
  --border:        #e4e4e7;
  --border-strong: #d4d4d8;

  /* Text */
  --text:          #18181b;
  --text-muted:    #52525b;  /* secondary text. 7.7:1 on surface */
  --text-subtle:   #71717a;  /* captions, placeholders. 4.8:1 on surface. Never smaller than 12px */
  --text-inverse:  #ffffff;

  /* Accent (UI chrome only: primary buttons, focus, selection, links). Never used for map data. */
  --accent:        #2563eb;
  --accent-hover:  #1d4ed8;
  --accent-soft:   #eff6ff;  /* selected row, active nav background */
  --accent-fg:     #1d4ed8;  /* accent used as text */
  --accent-contrast: #ffffff; /* text and glyphs on an accent fill */
  --focus-ring:    #2563eb;

  /* Status: fill colours (markers, dots, strokes) */
  --moving:        #16a34a;
  --idle:          #d97706;
  --offline:       #71717a;
  --alert:         #dc2626;

  /* Status: text colours (AA on surface) */
  --moving-fg:     #15803d;
  --idle-fg:       #b45309;
  --offline-fg:    #52525b;
  --alert-fg:      #b91c1c;

  /* Status: tinted backgrounds for badges */
  --moving-bg:     #f0fdf4;
  --idle-bg:       #fffbeb;
  --offline-bg:    #f4f4f5;
  --alert-bg:      #fef2f2;

  /* Severity (text badges in lists, always with icon + label) */
  --sev-low:       #52525b;
  --sev-medium:    #b45309;
  --sev-high:      #c2410c;
  --sev-critical:  #b91c1c;

  /* Geofence kinds (map polygons, see §9.3) */
  --gf-depot:      #4f46e5;
  --gf-customer:   #0d9488;
  --gf-restricted: #dc2626;
  --gf-other:      #71717a;

  /* Feedback */
  --success:       #15803d;
  --warning:       #b45309;
  --danger:        #b91c1c;
  --info:          #1d4ed8;
}

.dark {
  --bg:            #09090b;
  --surface:       #18181b;
  --surface-2:     #27272a;
  --surface-3:     #3f3f46;
  --border:        #27272a;
  --border-strong: #3f3f46;

  --text:          #fafafa;
  --text-muted:    #a1a1aa;
  --text-subtle:   #8b8b94;
  --text-inverse:  #09090b;

  --accent:        #2563eb;
  --accent-hover:  #1d4ed8;
  --accent-soft:   #172554;
  --accent-fg:     #93c5fd;
  --accent-contrast: #ffffff;
  --focus-ring:    #60a5fa;

  --moving:        #4ade80;
  --idle:          #fbbf24;
  --offline:       #a1a1aa;
  --alert:         #f87171;

  --moving-fg:     #86efac;
  --idle-fg:       #fcd34d;
  --offline-fg:    #a1a1aa;
  --alert-fg:      #fca5a5;

  --moving-bg:     color-mix(in srgb, #4ade80 14%, var(--surface));
  --idle-bg:       color-mix(in srgb, #fbbf24 14%, var(--surface));
  --offline-bg:    color-mix(in srgb, #a1a1aa 14%, var(--surface));
  --alert-bg:      color-mix(in srgb, #f87171 14%, var(--surface));

  --sev-low:       #a1a1aa;
  --sev-medium:    #fcd34d;
  --sev-high:      #fdba74;
  --sev-critical:  #fca5a5;

  --gf-depot:      #818cf8;
  --gf-customer:   #2dd4bf;
  --gf-restricted: #f87171;
  --gf-other:      #a1a1aa;

  --success: #86efac; --warning: #fcd34d; --danger: #fca5a5; --info: #93c5fd;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-subtle: var(--text-subtle);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-accent-fg: var(--accent-fg);
  --color-moving: var(--moving);   --color-moving-fg: var(--moving-fg);   --color-moving-bg: var(--moving-bg);
  --color-idle: var(--idle);       --color-idle-fg: var(--idle-fg);       --color-idle-bg: var(--idle-bg);
  --color-offline: var(--offline); --color-offline-fg: var(--offline-fg); --color-offline-bg: var(--offline-bg);
  --color-alert: var(--alert);     --color-alert-fg: var(--alert-fg);     --color-alert-bg: var(--alert-bg);
  --color-danger: var(--danger);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
}
```

### 3.2 Rules

- **One accent.** It never encodes status. It may tint map data that belongs to the user's task — the selected-vehicle ring and the playback route — but status, severity and geofence hues always win. The user chooses one of four accents in the user menu's Appearance section:

  | Accent | Light `--accent` | Dark `--accent` | Why |
  |---|---|---|---|
  | Blue (default) | `#2563eb` | `#2563eb` | The existing default; white text passes on the deep fill. |
  | Violet | `#7c3aed` | `#7c3aed` | A distinct hue family from status reds and ambers. |
  | Fuchsia | `#c026d3` | `#c026d3` | Distinct from the indigo and teal geofence hues. |
  | Graphite | `#475569` | `#64748b` | Desaturated chrome that cannot be mistaken for a status. |

  Each accent defines the full set (`--accent`, `--accent-hover`, `--accent-soft`, `--accent-fg`, `--accent-contrast`, `--focus-ring`) for both themes. Teal was removed because it collided with `--gf-customer`; a stored unknown accent falls back to Blue. `src/theme/accents.test.ts` computes the WCAG ratios from this file for every accent and theme.
- **Fill vs text.** `--moving`, `--idle` fail contrast as text on white. Use `*-fg` for any text or icon on a surface, `*` only for dots, strokes and marker fills.
- **Never colour alone.** Every status has a colour, a shape or icon, and a text label (§9.1, §10.4).
- **Dark mode** follows the system setting by default, with a manual segmented control (light, dark, system) in the user menu's Appearance section, persisted locally. Control rooms run at night, so dark mode is a first-class theme and is tested for every screen.
- **No gradients, no glassmorphism, no coloured shadows.** Panels are opaque.
- Contrast targets: body text 4.5:1 minimum, large text and UI boundaries 3:1 minimum ([WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)).

---

## 4. Typography

- **UI font:** Inter Variable. **Data font:** JetBrains Mono Variable, used for IMEI, plate numbers, IDs, coordinates and the audit log.
- All numbers in tables, KPIs, speeds, distances and timestamps use `tabular-nums`. Apply it globally to `td`, `.stat` and anything numeric.
- Sentence case everywhere. No ALL CAPS except the 11px `label-caps` style used for table column headers and KPI labels.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-xs` | 12 / 16 | 400 | captions, timestamps, helper text |
| `text-2xs` | 11 / 16 | 400 | map attribution chip only |
| `label-caps` | 11 / 16, tracking +0.04em | 600 | column headers, KPI labels |
| `text-sm` | 13 / 20 | 400 | dense table cells, list rows, secondary UI |
| `text-base` | 14 / 20 | 400 | default body and form controls |
| `text-md` | 16 / 24 | 500 | panel titles, drawer titles |
| `text-lg` | 20 / 28 | 600 | page titles |
| `stat` | 28 / 32 | 600 | KPI numbers (tabular) |

- Body text is never below 13px; captions never below 12px. The one exception is the map attribution chip, which is 11px licence text.
- Weights allowed: 400, 500, 600. No 700 or 300.
- Line length for prose (error text, help text) is capped at 60 characters (`max-w-prose` equivalent).
- Truncate with an ellipsis and a tooltip, never wrap inside table cells. Plates and IDs never truncate.

---

## 5. Spacing, sizing and layout

### 5.1 Scale

4px base grid. Allowed spacing steps: `1 (4)`, `2 (8)`, `3 (12)`, `4 (16)`, `6 (24)`, `8 (32)`, `12 (48)`. Nothing else.

| Element | Value |
|---|---|
| Panel padding | 12px (dense), 16px (forms) |
| Gap between related controls | 8px |
| Gap between groups | 16px |
| Table row height | 36px dense (default), 44px comfortable (setting) |
| Control heights | 28 (sm), 32 (md, default), 36 (lg) |
| Minimum pointer target | 28px desktop, 44px on touch breakpoints |

Nested actions inside a 56px vehicle row keep a 24px visual line but still offer the 44px touch target: the action grows symmetrically and negative vertical margins keep its layout contribution at one text line. The row's 56px selection button remains the primary target.

Shell and dialog sizes are tokens: `--spacing-touch: 44px`, `--spacing-rail-expanded: 200px`, `--spacing-topbar-offset: 60px` (48px top bar + 12px gap), `--container-dialog: 480px`, `--container-content: 1440px`. Use `size-touch`/`h-touch` below `md`, `max-w-dialog` for dialogs and `max-w-content` for non-map page content.

### 5.2 App layout

```
┌──────────────────────────────────────────────────────────────┐
│ Top bar 48px: Zoro · global search (/) · connection · user  │
│ (appearance lives inside the user menu, not the bar)        │
│ (mobile: Zoro · menu · search icon · connection · user)     │
├────┬─────────────────────────────────────────────────────────┤
│Nav │ Map (full-bleed, fills everything)                      │
│56px│  ┌─ Left panel 360px (floating, 12px inset) ─┐          │
│    │  │ search · filters · vehicle list           │  ┌─Drawer│
│    │  └───────────────────────────────────────────┘  │ 420px │
│    │  ┌─ KPI strip (floating, top centre) ────────┐  └───────┘│
└────┴─────────────────────────────────────────────────────────┘
```

- Navigation is a 56px icon rail with tooltips, expandable to 200px. Active item uses `accent-soft` background and `accent-fg` text.
- Non-map screens (alerts, trips, drivers, reports, audit) use a standard page layout: page title row, filter row, content. Max content width 1440px, left-aligned.
- Floating panels sit 12px from the **content area** edge, are opaque, have `--radius-lg`, one border, and `--shadow-float`. The content area starts below the top bar and the in-flow banner region, so a banner pushes every panel, drawer, sheet, control and attribution down with it.
- Panels are collapsible with `[`. The map must never be covered by more than 60% of its area at 1440px width.

### 5.3 Breakpoints

| Name | Min width | Behaviour |
|---|---|---|
| `sm` | 640 | single column pages |
| `md` | 768 | icon rail appears |
| `lg` | 1024 | left panel docks beside the map |
| `xl` | 1280 | drawer and left panel can be open together |
| `2xl` | 1536 | comfortable density option |

Below `lg`, the left panel and drawer become a **bottom sheet** with three snap points (peek 113px, half, full). The map remains interactive above it.

At `lg`–`xl` the vehicle drawer hides the left panel without changing the saved preference; the panel toggle stays visible with `aria-disabled` and the reason "Close the vehicle drawer to show the list." At `xl` and above both may be open. The drawer publishes `--map-inset-right` (432px) and the KPI's right edge moves to 444px, so nothing sits under it.

---

## 6. Shape and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | badges, checkboxes, table cell chips |
| `--radius-md` | 6px | buttons, inputs, menus |
| `--radius-lg` | 10px | floating panels, drawers, dialogs |
| `--radius-full` | 9999px | status pills, avatars, marker dots |
| `--overlay` | 40% black light, 60% black dark | dialog and sheet backdrops |

```css
--shadow-float: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.10);
--shadow-menu:  0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.10);
/* dark: increase alpha to 0.4 / 0.5 and always keep the 1px border */
```

- Elevation is expressed by **border first, shadow second**. Only floating panels, menus, popovers, dialogs and toasts have a shadow. Inline content (tables, forms, stat blocks) has a border and no shadow.
- No nested cards. A card inside a card is a layout mistake; use a divider.

### Layer model

z-index only orders elements inside one stacking context. The console therefore has one scale, defined as CSS variables in `src/ui/layers.css` and used only through named utilities; a numeric or arbitrary z-index elsewhere is a guard failure.

| Layer | Utility | Value | Where it applies |
|---|---|---|---|
| Map | `z-map` | 0 | the map surface |
| Map controls | `z-map-controls` | 10 | map controls, attribution, map-level notices |
| Panel | `z-panel` | 20 | the vehicle panel, KPI strip, bottom sheet, floating page panels |
| Drawer | `z-drawer` | 30 | the vehicle drawer and the page drawer |
| Top bar | `z-topbar` | 40 | shell chrome and page sticky headers |
| Dialog | `z-dialog` | 60 | modal dialogs and their backdrop |
| Popover | `z-popover` | 70 | menus, selects, comboboxes, the user menu |
| Toast | `z-toast` | 80 | the toast viewport |
| Tooltip | `z-tooltip` | 90 | tooltips |

The content area is `position: relative; isolation: isolate`, so its internal layers (map, controls, panels, drawer) can never paint above the top bar or an overlay, whatever number a component uses. The top bar is in the same shell stacking context but is not positioned against the viewport.

Every overlay above the shell renders through `LayerPortal` into one `#overlay-root`, with one container per layer. Popovers sit above dialogs deliberately: a menu, select or combobox opened inside a dialog must cover the dialog’s content and footer. A banner has no z-index because it is in normal flow, above the content area and below the top bar in document order.

The overlay root is outside the content area, so a modal dialog’s backdrop covers the map, drawer, sheet and banner. Overlay layers stay exposed to assistive technology while a dialog is open; the dialog, not the layer stack, owns modality.

---

## 7. Motion

Motion communicates a change of information, never decoration.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-fast` | 100ms | ease-out | hover, press, focus |
| `motion-base` | 150ms | ease-out | menus, tooltips, tab switch |
| `motion-slow` | 220ms | cubic-bezier(0.2, 0, 0, 1) | drawer and panel slide, bottom sheet |

- Animate only `opacity` and `transform`. Never animate `width`, `height` or `top` on layout. The drawer inset and control fades use `--motion-slow` (`220ms`) with `--ease-slow` (`cubic-bezier(0.2, 0, 0, 1)`); hover and menus use `--motion-fast` / `--motion-base` with `--ease-out`. While a sheet drag is active, `data-sheet-dragging="true"` suppresses those transitions. The bottom sheet's visible height snaps between snap points instead of transitioning: height is a layout property, and a transform cannot keep the bottom edge pinned while the top moves; the trade-off is recorded in `docs/decisions.md`.
- Marker movement: interpolate linearly between two position updates over the observed update interval, capped at 2s. No easing, no bounce. If an update is older than 10s, snap instead of gliding.
- New alert: the alert badge pulses twice (a 600ms ring), then stays static.
- Tables never animate layout. Skeletons use a gentle opacity pulse, never a shimmer; reduced motion disables it. Use the 2px indeterminate top bar for route or page loading, not a full-page spinner.
- The shell banner region is the one intentional layout animation: its grid track grows from `0fr` to `1fr` over `--motion-slow`, because overlays anchored to the content area must reflow with it. Reduced motion disables it.
- `@media (prefers-reduced-motion: reduce)`: remove all transitions except opacity, disable marker interpolation and pulses.

---

## 8. Iconography, imagery and voice

- Icons: Lucide, 16px in dense UI, 20px in navigation, 1.5px stroke, colour `currentColor`.
- No illustrations, stock imagery or emoji in the product UI.
- Copy is plain, specific and short.
  - Buttons are verbs: `Acknowledge`, `Create trip`, `Retry`.
  - Errors say what happened and what to do: `Couldn't load vehicles. Check your connection and retry.`
  - Empty states say why: `No vehicles match "KJA 123". Clear the filter to see all 20.`
  - Never blame the user. Never use "oops", "whoops" or exclamation marks.
- Use the server's `error.message` as a secondary detail line, not as the headline.

### 8.1 Brand

The brand is **Zoro**. Both marks are single-colour SVGs rendered by `src/ui/BrandLogo.tsx` with `fill="currentColor"`, so the logo follows `--text` and stays legible in light and dark. It never uses the accent, status or severity colours.

| Variant | Art | Where it is used |
|---|---|---|
| `lockup` | Symbol + Zoro wordmark | App top bar at `md` and up; the login header strip |
| `symbol` | Symbol only | App top bar below `md`; favicons, app icons and the maskable icon |

- **Size:** `22px` tall in the shell and login strip. The lockup is never smaller than `20px` tall; below `md` the symbol is used instead of shrinking the wordmark.
- **Clear space:** at least `8px` on every side, measured from the mark's bounding box. The top bar keeps `16px` from the left edge and a `gap-2` (`8px`) to the next control.
- **Position:** the login header strip and the app top bar share `src/ui/BrandBar.tsx` (`h-topbar`, `px-4`), so the mark cannot drift between the two screens. The top bar lockup links to the map; the login lockup is not a link.
- **Master files:** `src/assets/brand/zoro-lockup.svg` and `zoro-symbol.svg`. Do not add fills to them; recolour through `currentColor`.
- **Generated icons:** `npm run icons` renders the symbol with Playwright Chromium into `public/favicon-32.png`, `apple-touch-icon.png` and `public/icons/*.png`. The maskable icon keeps the symbol inside the central 80% safe zone on a solid dark background.

---

## 9. Data display rules

| Data | Format |
|---|---|
| Timestamp | Relative under 24h (`2m ago`), absolute otherwise (`2 Nov, 14:02`). Tooltip always shows full local time and the UTC value. Use `Intl.DateTimeFormat`. |
| Speed | integer, `62 km/h` |
| Distance | one decimal under 100 km, integer above, `12.4 km` |
| Heading | degrees plus compass, `272° W` |
| Coordinates | 5 decimals, mono, copyable on click |
| Plate / IMEI / IDs | mono, never truncated, copy-on-click with toast |
| Missing value | `—` (em dash), never `null`, `N/A` or blank |
| Counts | `Intl.NumberFormat`, thousands separators |
| Currency | none in v0.1 |

### 9.1 Vehicle status

The API gives `online`; the UI derives a display status. The derivation lives in one function, `getVehicleStatus()`, and nowhere else.

| Status | Colour | Marker shape | Label |
|---|---|---|---|
| Moving | `--moving` | filled circle with heading chevron | Moving |
| Idle | `--idle` | filled circle, no chevron, pause glyph in the drawer | Idle |
| Offline | `--offline` | hollow circle (2px stroke) | Offline |
| Alert | `--alert` | filled circle with a white `!` and an outer ring | Alert |

Alert outranks the other statuses for display. The list shows the status as a pill (§10.4) next to the plate. On the map, alert status comes from open alerts inside a 15-minute window (not from every historical open alert); the KPI and Alerts screen still count every open alert.

### 9.2 Data freshness

Defaults, tune against real update intervals:

| Age of last update | Treatment |
|---|---|
| ≤ 30s | fresh, no indicator |
| 30s to 5min | `delayed`: timestamp turns `--idle-fg`, clock icon |
| > 5min or socket down | `stale`: timestamp `--alert-fg`, striped top border on the panel, label `Stale · 14:02` |

The KPI strip always shows `last data age`. The top-bar connection indicator has four states: `Live` (green dot), `Reconnecting…` (amber dot), `Offline` (grey dot, `Showing data from 14:02`) and, until the live socket ships in Slice 2, `Online` (green dot, meaning the browser can reach the server). The label collapses to a dot with the accessible name `Connection: …` below `md`.

### 9.3 Map layers

- **Basemap:** desaturated, low contrast, minimal labels, so markers carry the visual weight. The map is provider-neutral: colours, stroke patterns and marker anatomy reach every adapter through `MapTokens` (`src/map/tokens.ts`), and each adapter ships light and dark styles. Offline support is a declared adapter capability; the MapLibre adapter uses a self-hosted PMTiles file.
- **Vehicle marker:** 24px circle, 2px ring in `--surface`, shadow-menu. Plate label appears at zoom ≥ 13 in a 12px chip. The label uses the basemap's Noto Sans glyphs until the self-hosted mono glyph pack ships; this is a recorded deviation, not a design change. Below zoom 11, vehicles cluster; the cluster shows its count and takes the colour of the worst status inside.
- **Selected vehicle:** 2px `--accent` outer ring and the marker raised above the others.
- **Map controls:** app-level, provider-neutral, 36px at `md` and up and 44px on touch. The vertical stack sits bottom-right, uses `--surface`, `--border`, `--shadow-float` and `--radius-md`, and shifts around panels with `--map-inset-right` and `--map-inset-bottom` (transform only). Native adapter controls are hidden. Attribution is a separate static chip that never fades with the controls and is never hidden; it is a licence requirement.
- **Satellite:** online-only, env-gated, and clearly secondary to the data layers. On imagery every marker gets a 2px halo in `--imagery-halo`, geofence strokes and the playback route get a wider halo, and label halos grow to 2px. Vehicles, geofences and labels must stay legible on both basemaps.
- **Geofence:** polygon fill at 12% opacity, 2px stroke. Kind is encoded by colour *and* stroke pattern:

  | Kind | Colour | Stroke |
  |---|---|---|
  | depot | `--gf-depot` | solid |
  | customer | `--gf-customer` | dotted |
  | restricted | `--gf-restricted` | dashed, plus diagonal hatch fill |
  | other | `--gf-other` | thin solid |

  Geofence name appears at zoom ≥ 12.
- **Playback route:** 3px line in `--accent`, direction chevrons every 80px, a filled accent start pin, a surface-filled accent-ringed end pin, `Start`/`End` labels from zoom 12, and a 7px accent cursor with a surface ring. Missing-data segments are dashed instead of pretending the straight connector is a route; the cursor stays on the last known point across a gap. The cursor sits above the pins and the pins above the line.
- The map has an accessible equivalent: the vehicle list. Every marker action is also reachable from the list.

---

## 10. Components

Each component lists its anatomy and its rules. All come from shadcn primitives restyled to the tokens.

### 10.1 Button

| Variant | Appearance | Use |
|---|---|---|
| `primary` | `--accent` fill, `--text-inverse` text | one per view, the main action |
| `secondary` | `--surface` fill, 1px `--border-strong` | default actions |
| `ghost` | transparent, `--surface-2` on hover | toolbars, row actions |
| `destructive` | `--danger` text on secondary, filled only inside a confirm dialog | delete, cancel trip |

- Heights 28/32/36, horizontal padding 12px, `--radius-md`, text `text-base` weight 500.
- Loading: the label stays, a 14px spinner replaces the leading icon, the button is disabled and `aria-busy`.
- Disabled by role: stays visible with a tooltip explaining why (`Viewers can't acknowledge alerts`). Navigation items the role cannot access are **hidden**, not disabled.
- Icon-only buttons are square (same size as height) and require `aria-label` and a tooltip.

### 10.2 Inputs

- 32px tall, `--surface` fill, 1px `--border-strong`, 16px horizontal padding, `--radius-md`. Focus: the border becomes `--accent` and a 1px inset `--focus-ring` ring appears. The control does not grow or shift.
- Label always visible above the field. Placeholder is an example, never the label.
- Error: 1px `--danger` border, message below in `text-sm` with an icon, linked via `aria-describedby`.
- Validate on blur and on submit. Submit is disabled only while pending, never because the form is invalid.
- Native controls are restyled: the checkbox uses the accent fill and check, and the selected select option uses `--accent`. Do not leave browser-default blue in the UI.
- Textareas do not expose the native resize handle. Keep a fixed minimum height and let the layout own the height; auto-grow only when a flow genuinely needs it.
- Native select popup hover/focus is browser-controlled. The selected option is styled with `option:checked`; a fully custom listbox is the only way to control every popup state.
- **SearchField** (`src/ui/SearchField.tsx`) is the only search-shaped control. Every picker and the plate/IMEI search use it, so their height, icon, ring and placeholder cannot drift apart:
  - 44px tall on touch and `md:h-control-md` (32px) from `md`, `--surface` fill, 1px `--border-strong`, `--radius-md`, `text-base`, placeholder `--text-subtle`.
  - The leading 16px Lucide `Search` icon sits in a flex-centred `inset-y-0 left-4` slot inside the same relatively positioned control as the input; the input clears it with `pl-10`. The optional trailing slot (clear button, `/` hint, combobox chevron) sits at `right-3`; the input clears it with `pr-14`. Each icon's vertical centre equals the input's, because both are centred in the control the input moves with, never against an ancestor.
  - Focus is the shared `--accent` border plus a 1px inset `--focus-ring` ring. The control never grows or shifts.
  - `SearchInput` adds the 150ms debounce, the clear button and the `/` hint on top of `SearchField`. `Combobox` composes the same field with a chevron trailing slot.
- Compact exception: the mobile sheet header may use a visually hidden label for the search field because the row has no space for a second label line. The magnifier and placeholder remain, and the accessible name is still `Search vehicles`.

### 10.3 Table

Every table uses the shared `DataTable` primitive (`src/ui/DataTable.tsx`). Its column list is the only source of headers, widths and alignment.

- Real `<table>` with a sticky header, 36px rows (`--spacing-row`), `--border` row dividers, no zebra striping.
- Header: `label-caps`, `--text-muted`. Sortable columns show an arrow and use `aria-sort`.
- Layout is `table-layout: fixed`. Widths come from one column-definition list (`id`, `header`, `width`, `align`, `cell`, `sortable`). The table's `min-width` is the sum of those widths, and it sits in a horizontal scroll container. Widths never depend on which rows are mounted.
- Cells never wrap: `nowrap`, `overflow: hidden` and ellipsis, with a tooltip that shows the full value. Plates and IDs never truncate.
- Every row uses the fixed row-height token, and the virtualizer uses the same value. No per-row measured heights.
- Header alignment equals cell alignment in every column. Time and text columns are left-aligned. Numeric measures are right-aligned and tabular. Alignment never changes with viewport, scroll position or content.
- Every cell has at least a 12px inset left and right, including cells that hold badges. A badge never touches a cell edge or divider.
- Narrow screens use the same nowrap table with horizontal scrolling. The header and the first column are sticky. Nothing reflows while scrolling.
- Scrolling changes nothing: header cell widths and content-relative x positions are identical before and after scrolling through the list. `expectStableColumns` in `e2e/helpers` enforces this.
- Hover: `--surface-2`. Selected: `--accent-soft` plus a 2px `--accent` left edge.
- Large lists (500 or more rows, e.g. vehicles): virtualise with TanStack Virtual inside the table's scrollport. Paging follows the API (`limit` / `offset`, no totals): show `Load more` when the last page was full.
- Row click opens detail; the first cell is the keyboard target (`Enter`). The extra 44px touch target of an inline action uses symmetric negative margins so it never changes the 36px row height.
- Skeletons use the same column widths and row height as the real table.

### 10.4 Status pill and badges

Anatomy: `[icon or dot] [label]`, 20px tall, `--radius-full`, `text-xs` weight 500, tinted `*-bg` background, `*-fg` text, no border.

- Vehicle status pills use the §9.1 shapes as the leading glyph (not just a dot).
- Alert severity badges: `[icon] Critical`, `--radius-sm`, icon per level (info, alert-triangle, alert-octagon), text in `--sev-*`.
- Alert status: `Open` (outlined, `--alert-fg`), `Acknowledged` (filled neutral with a check), `Closed` (muted).
- Trip status: `Planned`, `Assigned`, `Active` (accent-soft), `Completed` (success), `Cancelled` (muted, strikethrough not used).

### 10.5 Stat (KPI)

Not a decorative card. A bordered cell in a single strip with 16px horizontal and vertical padding: `label-caps` label above a `stat` number, one optional delta or hint line in `text-xs`. The label row may carry one optional leading status indicator (System health's status dot); it sits before the label and never replaces the text meaning. Clicking a stat filters the relevant view (`Open alerts` opens Alerts filtered to open).

Below `lg`, the map uses the compact variant: a 2×2 grid of the same four cells with a 20px number, `py-2`, and no left border. The strip leaves a right gutter for native map controls.

### 10.6 Drawer (vehicle detail)

- 420px, right side, floating panel: `right-3 top-3 bottom-3`, `--radius-lg`, one border, `--shadow-float`, z-30. It is a non-modal `<aside>` labelled "Vehicle details for {plate}": the map, list and controls stay interactive, focus is not trapped, and Escape is handled explicitly (and does not reach the global shortcut).
- Header: plate (mono, copy-on-click), status pill, stale badge, close button. Sticky.
- A sticky action row sits under the header: `Centre on map`, `Play back`, `Edit`, `Assign driver`. Disabled actions stay visible and focusable with `aria-disabled` and a tooltip reason.
- Sections in this order: current state (speed, heading, last seen, online, freshness, coordinates), trip, driver, vehicle details, recent events. Use divider rows, not nested cards.
- `Esc` closes. Focus moves to the close button on open and returns to the originating row (or the mobile sheet handle) on close.
- Data refreshes in place without layout shift; changed values get a 600ms background tint (`--accent-soft`) that fades. The tint remounts the value, so it needs no timer and disappears under reduced motion.
- The write-only device fields show `—` with one line: "Device fields aren't returned by the API."
- **Page placement** (`placement="page"`): the same non-modal drawer, used by the Alerts detail. At `md+` it is the familiar 420px right panel (`right-3`, `top-topbar-offset`, `bottom-3`), where `--spacing-topbar-offset` is the 48px top bar plus a 12px gap. Below `md` it becomes a bottom sheet anchored at `top-1/4`, leaving the page title and tabs visible; it has no drag handle or snap points. It moves focus to its close button on open, stops Escape before the global shortcut, and returns focus to the originating row. The title uses the UI font rather than the mono plate style.

### 10.7 Dialog and confirm

- Centred, 480px max, `--radius-lg`, focus trapped, `Esc` closes.
- Destructive confirms name the object (`Delete geofence "Refinery gate"?`), state the consequence, and offer `Cancel` (default focus) and the destructive button.
- When the API blocks an action (geofence with events), show the server reason inline in the dialog. Do not close it.

### 10.8 Toast

Bottom-right, 4s, one line plus an optional action. Success and info auto-dismiss; errors persist until dismissed. Never use a toast as the only record of an important result; alerts and audit entries live in their own screens. Respect `aria-live="polite"` (`assertive` for errors).

### 10.9 Tooltip, menu, tabs, select, combobox

- Standard Radix behaviour. Tooltip delay 400ms, content `text-xs`, never the only way to reach information. Menus 32px items, `--shadow-menu`. Tabs use an underline indicator in `--accent`, 36px height.
- `Combobox` is the searchable single-select for long, changing lists (for example active drivers). It uses the ARIA 1.2 combobox/listbox pattern: a labelled input owns the keyboard, `aria-expanded`/`aria-controls`/`aria-activedescendant`/`aria-haspopup` are wired, options show a second line with the disambiguating detail (phone and licence for duplicated names), filtering ignores case, spaces and hyphens, and the list resets on blur. Options are 44px on touch. A plate or IMEI option renders its primary line in the mono font. Loading, error, empty and disabled states are explicit; the disabled reason stays visible.
- The combobox list is an overlay in the popover layer, never in the dialog's flow. Opening it must not change the input's or the dialog's bounding box. It is `position: fixed`, anchored 4px below the input, at least 240px wide and as wide as the input (clamped to the visual viewport), with a maximum height from `visualViewport` and its own scrollport. It flips above the input when the space below is short, and it is capped by the dialog's close button and footer, so neither is ever covered and both stay hit-testable — also with the software keyboard open. Every picker uses this behaviour; there is no per-dialog opt-in.
- Keyboard: `ArrowUp`/`ArrowDown`/`Home`/`End` move `aria-activedescendant` and scroll the active option into view, `Enter` selects, the first `Escape` closes only the list and keeps focus in the input, and the second closes the dialog. Focus never leaves the input while the list is open.

### 10.10 Map controls

- Anatomy: a top group of square icon buttons inside one bordered surface, then the style trigger. Desktop order: zoom in, zoom out, reset bearing, fit, geofences, panel. Mobile order: zoom in, zoom out, reset bearing, style; fit and geofences live in the sheet header.
- The bearing control shows the current bearing by rotating the compass glyph and dims at north; its accessible name reports `Facing north` or `Facing 272° W`.
- Zoom limits disable the relevant button with `Minimum zoom` / `Maximum zoom`; fit with no positioned vehicles disables with the reason `No vehicles are reporting a position`.
- The style picker is a menu with radio semantics. Satellite is disabled with `Satellite needs a connection` offline and omitted entirely when the build has no tile source.
- When the mobile sheet is above 60% height the stack fades and becomes inert (and any open menu closes). It never covers the KPI strip, a panel, the drawer or the attribution.
- When the desktop vehicle drawer is open, the KPI's right edge moves to 444px and the controls stack translates left by 432px (`--map-inset-right`); at `lg`–`xl` the left panel hides, at `xl` it may stay open. It is a transform, never a width change.
- Attribution is a single 11px line chip (`whitespace-nowrap`). Below `lg` it is the bottom item of the same bottom-right stack, right-aligned and 8px below the controls. It is a sibling of the controls, so it stays visible when they fade, and it rides the sheet inset to stay 12px above the sheet at every snap.

### 10.11 Appearance controls

- Live inside the user menu as a labelled group: a segmented theme row (light, dark, system) and four accent swatches. They are menu radio items and do not close the menu on change.
- The swatch is a small visual inside a full menu row; the row keeps the menu's touch target.

### 10.12 Evidence list

- Free-form evidence renders as a definition list of humanised keys and mono values: numbers keep their units, booleans become Yes/No, nested values are JSON text, and missing values are `—`.
- UUID-like values are copy-on-click. Nothing in evidence is ever rendered as HTML.
- Empty evidence says "No evidence recorded." A detail may offer a "Raw JSON" toggle; it renders a scrollable `<pre>` of the stringified object, text only.

---

## 11. Required states

Every list, table, panel and map layer implements all five. Build them with the shared `<StateBoundary>` component so they stay consistent. Pessimistic mutations show a transient pending overlay on the loaded state.

| State | Treatment |
|---|---|
| **Loading** | Skeleton of the real layout (same row height and columns). No full-page spinners. Show skeletons after 200ms to avoid flashes. |
| **Empty** | Icon, one-line reason, one primary action. Distinguish `no data yet` from `no results for this filter`. |
| **Error** | Message plus `Retry`. Preserve any previously loaded data below it, dimmed. |
| **Stale** | Data stays visible; the panel shows `Stale · <time>` (§9.2). Mutating actions are disabled with a reason while offline. |
| **Forbidden** | `You don't have access to this.` plus a link back. Role gating is enforced by the API; the UI never relies on hiding alone. |
| **Pending** | Keep the previous row visible at reduced opacity and put a spinner in the existing action slot. Do not add text or columns that move the layout. Apply the server result on success; on error, restore the row and announce the error. |

Global banners live below the top bar **in normal flow**, in one region that collapses to zero height when no banner is present. Only the highest-priority banner shows at a time, in this order:

1. **Session expired:** `Your session expired. Sign in again.` Danger tone. The blocking re-sign-in dialog is the action; the banner states the reason behind it.
2. **Offline:** `You're offline. Showing data from 14:02. Changes are disabled.` Neutral background, wifi-off icon.
3. **Live updates unavailable (after 60s) or error storm:** `Live updates are unavailable. Showing data from 14:02.` with `Retry now`, or `We're having trouble reaching the server. Retrying…` with `Open System`. Warning tone. Automatic attempts continue at the 30s backoff cap.
4. **Reconnecting:** `Reconnecting to live updates…` warning tone.
5. **Update available:** `A new version is available.` with `Reload`, info tone. Never reload mid-view without the click.

The banner region shrinks the content area by exactly the banner’s height, so the map, drawer, sheet, panels, controls and attribution always start at or below the banner. The region animates its grid track with `--motion-slow`; reduced motion disables the animation. Nothing may be fixed to the viewport inside the map screen.

---

## 12. Keyboard and focus

- Focus is always visible. Inputs use an accent border plus a 1px inset `--focus-ring` ring. Buttons and other controls use a 2px `--focus-ring` outline with no offset. Never `outline: none` without a replacement.
- Tab order follows visual order. Panels trap focus only when modal (dialogs).
- Shortcuts (disabled while typing in an input; list shown with `?`):

| Key | Action |
|---|---|
| `/` | focus vehicle search |
| `j` / `k` | next / previous vehicle in list |
| `Enter` | open selected vehicle drawer |
| `Esc` | close drawer, clear selection, clear search |
| `[` | toggle left panel |
| `g` then `m` / `a` / `t` / `d` / `r` | go to Map / Alerts / Trips / Drivers / Reports |
| `a` (alert row focused) | acknowledge |
| `Space`, `←`, `→`, `,`, `.` (playback) | play-pause, step back, step forward, slower, faster |

---

## 13. Accessibility

- Target WCAG 2.2 AA.
- All status, severity and geofence kinds have a non-colour channel (§9).
- Live regions: new alerts announce via `aria-live="polite"`; `critical` severity uses `assertive`. Throttle announcements to one per 5s and batch (`3 new alerts`).
- The map is not the only access path to any data (§9.3).
- Forms: labels, `aria-describedby` for errors, error summary at the top for submissions with more than one error.
- Touch targets at touch breakpoints are 44px. Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Test with keyboard only and run `axe` in the Playwright suite on each screen.

---

## 14. Offline and connectivity presentation

- Offline is a normal state, not an error. The shell loads from the service worker; data comes from the persisted query cache.
- Every screen shows the age of its data when it is not live (§9.2, §11).
- Mutations are disabled offline with an explanatory tooltip. Never queue writes silently.
- On reconnect: resync from `/live/snapshot` first, then apply socket messages, then clear the stale treatment. Show `Reconnecting…` for the whole gap.
- Show an `Install app` affordance in the user menu when the PWA prompt is available. Never a modal.

---

## 15. Screen composition patterns

| Screen | Pattern |
|---|---|
| Map | Full-bleed map, left list panel, KPI strip, right drawer, app-level map controls. Below `lg` the panel becomes a bottom sheet with peek (113px), half and full snap points; the KPI strip becomes the compact 2×2 grid; fit and geofence controls move into the sheet header. The vehicle detail sheet reuses the same 113px header rhythm: 8px drag band, a 44px plate/status/close row, an 8px gap, a 44px icon-action row, 8px bottom padding and a 1px separator. It defaults to half, the body is inert at peek, and at full it ends 80px below the top bar; closing it returns the list sheet at its previous snap. The sheet header is 113px and always visible: an 8px drag band, a 44px title/count/fit/geofences/filters row, and a 60px search row holding a 44px field with 8px above and below. The header is one opaque `surface` region and the single owner of the header separator: a 1px `border` line as its own bottom border, spanning the sheet's full width. The sheet edges are a non-layout ring and the row dividers share the separator's left and right x; a bottom safe-area inset is reserved inside the sheet so the last row clears it. Only the vehicle list scrolls, inside the sheet with contained overscroll; the header never moves and list scrolling never drags the sheet. At full the sheet ends 80px below the top bar, the KPI is hidden, and tapping that map strip returns to half. The controls stack sits bottom-right and shifts with `--map-inset-bottom` / `--map-inset-right`; above 60% sheet height it fades and goes inert. Vehicle rows are 56px, two lines: status pill, mono plate and data age; driver and speed. The plate is a copy button layered above the row's selection button. The map tooltip shows plate, speed and data age, clamped to the map edge. Attribution is a static link rendered by the feature, never injected from a remote style. |
| Alerts, Trips, Drivers, Audit | Page title, filter row (selects and search, 32px), dense table, detail in a right drawer, never a separate page. Alerts uses the shared `Drawer` page placement: right panel at `md+`, top-quarter sheet below `md`, always leaving the title and tabs visible. The alert detail's static map is the same `FleetMap`, labelled "Alert position", with the shared attribution chip. |
| Geofences | Split view: list left (360px), map right with draw tools; unsaved polygon shown with dashed `--accent` stroke |
| Playback | Full-bleed standard map with the route, floating header (back, plate, IMEI, offline badge, change vehicle), and a bottom control bar measuring its own height for camera padding: range and resolution selects, transport, speed, speed/heading readouts, point count, Fit route, Events menu, the scrubber with gap bands and event markers, and gap labels. The attribution chip sits above the bar, never under it. Below `md` the bar stacks and every control keeps a 44px target. |
| Import | Drop zone with expected headers listed, then a result summary (total, imported, failed) and an error table limited to the first 100 rows |
| Reports | Range picker (default 7 days), a row of stats, horizontal bar chart for alerts by type |
| System | Grid of stats grouped by Dependencies, Fleet, Ingest; each stat has a status dot and a label; green means healthy, any non-green is sorted first |
| Login | Centred 360px form on `--bg`, no illustration, error and rate-limit messages inline |

Charts: simple horizontal bars drawn with SVG or CSS, one series in `--accent`, direct value labels, no pie or donut charts, no gradients, no animation.

---

## 16. Code conventions for UI

```tsx
// Variants via cva, tokens only
const pill = cva("inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium", {
  variants: {
    status: {
      moving:  "bg-moving-bg text-moving-fg",
      idle:    "bg-idle-bg text-idle-fg",
      offline: "bg-offline-bg text-offline-fg",
      alert:   "bg-alert-bg text-alert-fg",
    },
  },
});
```

- One component per file, named export, typed props interface. Co-locate tests.
- Compose, do not configure: prefer small components with children over components with ten props.
- No business logic in components. Derive display values in hooks or pure functions (`getVehicleStatus`, `formatSpeed`, `formatAge`) with unit tests.
- Class strings are ordered by the Prettier Tailwind plugin. Do not hand-sort.
- No `!important`, no global CSS outside `tokens.css` and `base.css`.
- A `/styleguide` route renders every component in every variant and state, in both themes. It is the visual regression surface: Playwright screenshots it at 1440px and 390px.

---

## 17. Design QA checklist (definition of done for any UI work)

- [ ] Only tokens used; no arbitrary values, no raw colours.
- [ ] Light and dark themes both checked.
- [ ] Loading, empty, error, stale and forbidden states exist and look intentional.
- [ ] Status and severity readable without colour.
- [ ] All numbers tabular; missing values are `—`.
- [ ] Keyboard path works end to end; focus visible; `Esc` behaves.
- [ ] Contrast meets §3.2; `axe` reports no violations.
- [ ] Works at 1440px, 390px and 360px; no horizontal page scroll.
- [ ] Map controls, attribution, KPI, panels and the sheet never overlap at any snap point.
- [ ] The top bar contains no standalone theme or accent control; appearance lives in the user menu.
- [ ] The vehicle drawer is non-modal, keeps the map interactive, and returns focus to its origin; disabled actions stay visible with a reason.
- [ ] The page drawer leaves the page title and tabs visible at every viewport; the Alerts mobile sheet starts at `top-1/4`.
- [ ] Evidence renders as text, never HTML; raw JSON is a `<pre>`; an acknowledged alert shows its time and no invented actor.
- [ ] The live-alert pill is a button, not a second live region; the global toast remains the single announcement.
- [ ] Write-only device fields show `—` with the API limitation, not an empty field pretending to be known.
- [ ] Reduced-motion respected.
- [ ] Offline behaviour verified (service worker on, network off).
- [ ] No gradients, no nested cards, no decorative elements, no more than one primary button per view.
- [ ] `npm run check` passes.

---

## 18. Further reading

- Tailwind v4 theme variables: https://tailwindcss.com/docs/theme
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- Map style specs per adapter, e.g. MapLibre: https://maplibre.org/maplibre-style-spec/
- Refactoring UI (practical visual hierarchy and spacing): https://www.refactoringui.com

---

## Theme Runtime

`ThemeProvider` persists both preferences through `src/lib/storage.ts`:
- Theme: `fleet.theme` (`light`, `dark`, `system`)
- Accent: `fleet.accent` (`blue`, `violet`, `fuchsia`, `graphite`)

The inline script in `index.html` validates both values and applies the resolved theme class plus `data-theme` and `data-accent` on `<html>` before first paint, so there is no flash and React's first render agrees with the pixels already on screen. The Appearance section in the user menu uses the same store, so its segmented theme control and swatches stay in sync with `/styleguide`.

Accents affect interface chrome only. They never replace semantic status colours. Each accent provides its own `--accent-contrast` so white text on the accent fill, checkbox checks and selection backgrounds pass 4.5:1 in both themes.

---

## Visual Contract

`/styleguide` is the visual contract.
Add new shared components and their states there.

Review components in:
- Light theme
- Dark theme
- Blue accent
- Violet accent
- Fuchsia accent
- Graphite accent
- Compact search and the `lg` icon button used by map controls
