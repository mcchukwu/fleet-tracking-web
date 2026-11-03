import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";
import { installPreloadErrorHandler, installWindowErrorHandlers } from "./errors/global";
import { installNetworkListeners } from "./stores/connection";

function rootElement(): HTMLElement {
  const element = document.getElementById("root");
  if (!element) throw new Error("Root element not found");
  return element;
}

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker();
  }

  installNetworkListeners();
  installWindowErrorHandlers();
  installPreloadErrorHandler();

  createRoot(rootElement()).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
