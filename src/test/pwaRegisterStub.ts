import type { RegisterSWOptions } from "vite-plugin-pwa/types";

/** Unit-test stand-in for Vite's `virtual:pwa-register` module. */
export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
