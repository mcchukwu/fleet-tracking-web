import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

export function createApiProxy(target: string): ProxyOptions {
  // changeOrigin rewrites Host, not Origin. Staging enforces WS_ALLOWED_ORIGINS,
  // so the upgrade must carry the staging origin even though the browser is local.
  const origin = new URL(target).origin

  return {
    target,
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: { '*': '' },
    configure: (proxy) => {
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.setHeader('Origin', origin)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_PROXY_TARGET ||
    process.env.VITE_PROXY_TARGET ||
    'https://fleet-demo.165-232-96-216.sslip.io'

  return {
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      proxy: {
        '/api': createApiProxy(proxyTarget),
      },
    },
  }
})
