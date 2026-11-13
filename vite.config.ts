import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { manifestFromTokens } from "./src/pwa/manifest.ts";

export function createApiProxy(target: string): ProxyOptions {
  // changeOrigin rewrites Host, not Origin. Staging enforces WS_ALLOWED_ORIGINS,
  // so the upgrade must carry the staging origin even though the browser is local.
  const origin = new URL(target).origin;

  return {
    target,
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: { "*": "" },
    configure: (proxy) => {
      proxy.on("proxyReqWs", (proxyReq) => {
        proxyReq.setHeader("Origin", origin);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_PROXY_TARGET ||
    process.env.VITE_PROXY_TARGET ||
    "https://fleet-demo.165-232-96-216.sslip.io";
  const swDev = env.VITE_SW_DEV === "1";
  if (env.VITE_MOCK === "1" && swDev) {
    throw new Error(
      "VITE_MOCK=1 and VITE_SW_DEV=1 cannot run together: MSW and the service worker share one scope.",
    );
  }
  const tokensCss = readFileSync("src/styles/tokens.css", "utf8");
  const appVersion = env.VITE_APP_VERSION || process.env.npm_package_version || "dev";

  return {
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    build: {
      manifest: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] }),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "prompt",
        injectRegister: false,
        manifest: manifestFromTokens(tokensCss),
        devOptions: { enabled: swDev },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,woff2,png,svg,pbf,json,webmanifest}"],
          globIgnores: ["**/mockServiceWorker.js", "**/map/*.pmtiles", "**/sw.js"],
        },
      }),
    ],
    server: {
      proxy: {
        "/api": createApiProxy(proxyTarget),
      },
    },
  };
});
