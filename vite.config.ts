import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'https://fleet-demo.165-232-96-216.sslip.io'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: true,
        ws: true,
        cookieDomainRewrite: { '*': '' },
      },
    },
  },
})
