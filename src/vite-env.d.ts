/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MAP_PROVIDER?: string;
  readonly VITE_MAP_STYLE_URL_LIGHT?: string;
  readonly VITE_MAP_STYLE_URL_DARK?: string;
  readonly VITE_MAP_GLYPHS_URL?: string;
  readonly VITE_MAP_PMTILES_URL?: string;
  readonly VITE_MAPTILER_API_KEY?: string;
  readonly VITE_SW_DEV?: string;
  readonly VITE_FLEET_DEBUG?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_MOCK?: string;
  readonly VITE_DEMO_HINTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
