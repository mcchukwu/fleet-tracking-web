import { registerSW } from "virtual:pwa-register";
import type { RegisterSWOptions } from "virtual:pwa-register";
import { setPwaDebug } from "../dev/debug";
import { normalize } from "../errors/normalize";
import { recordError } from "../errors/report";
import { setUpdateHandler } from "./update";

export interface PwaEnv {
  dev: boolean;
  swDev: boolean;
}

export interface StartPwaOptions {
  env?: PwaEnv;
  register?: (options?: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;
}

export function shouldRegisterPwa(env: PwaEnv): boolean {
  return !env.dev || env.swDev;
}

function defaultEnv(): PwaEnv {
  return {
    dev: import.meta.env.DEV,
    swDev: import.meta.env.VITE_SW_DEV === "1",
  };
}

/**
 * Registers the prompt-style service worker. Nothing reloads automatically:
 * `onNeedRefresh` raises the existing update banner, whose action calls the
 * returned update function through `activateUpdate`.
 */
export function startPwa(options: StartPwaOptions = {}): void {
  const env = options.env ?? defaultEnv();
  if (!shouldRegisterPwa(env)) return;
  const register = options.register ?? registerSW;

  setPwaDebug({ serviceWorker: "registering" });
  const update = register({
    immediate: true,
    onNeedRefresh() {
      setPwaDebug({ updateAvailable: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fleet:update-available"));
      }
    },
    onOfflineReady() {
      setPwaDebug({ serviceWorker: "ready" });
    },
    onRegisteredSW() {
      setPwaDebug({ serviceWorker: "ready" });
    },
    onRegisterError(cause) {
      setPwaDebug({ serviceWorker: "error" });
      recordError(
        normalize(cause, { action: "register the service worker", resource: "service worker" }),
      );
    },
  });

  setUpdateHandler(update);
}
