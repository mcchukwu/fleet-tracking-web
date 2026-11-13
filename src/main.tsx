import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";
import { loadOfflineProfile } from "./auth/offlineProfile";
import { useAuthStore } from "./auth/store";
import { restorePersistedCache, reportStorageUnavailable } from "./api/persistedCache";
import {
  createQueryClient,
  installPreloadErrorHandler,
  installWindowErrorHandlers,
} from "./errors/global";
import { normalize } from "./errors/normalize";
import { recordError } from "./errors/report";
import { withTimeout } from "./lib/withTimeout";
import { captureInstallPrompt } from "./pwa/install";
import { startPwa } from "./pwa/register";
import { installNetworkListeners } from "./stores/connection";

const STARTUP_STORAGE_TIMEOUT_MS = 2_000;

function rootElement(): HTMLElement {
  const element = document.getElementById("root");
  if (!element) throw new Error("Root element not found");
  return element;
}

async function restoreProfile(): Promise<void> {
  try {
    const user = await withTimeout(loadOfflineProfile(), STARTUP_STORAGE_TIMEOUT_MS);
    if (user) useAuthStore.getState().setOfflineProfile(user);
  } catch (cause) {
    reportStorageUnavailable();
    recordError(
      normalize(cause, { action: "restore the offline profile", resource: "device storage" }),
    );
  }
}

async function restoreCache(queryClient: ReturnType<typeof createQueryClient>): Promise<void> {
  try {
    await withTimeout(restorePersistedCache(queryClient), STARTUP_STORAGE_TIMEOUT_MS);
  } catch (cause) {
    reportStorageUnavailable();
    recordError(
      normalize(cause, { action: "restore the offline cache", resource: "device storage" }),
    );
  }
}

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker();
  }

  const queryClient = createQueryClient();
  installNetworkListeners();
  installWindowErrorHandlers();
  installPreloadErrorHandler();
  captureInstallPrompt();

  await restoreProfile();
  await restoreCache(queryClient);

  createRoot(rootElement()).render(
    <StrictMode>
      <App queryClient={queryClient} />
    </StrictMode>,
  );

  startPwa();
}

void bootstrap();
