import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demo = mode === 'demo'

  return {
    // The demo is one self-contained HTML file (in-browser API, inlined assets).
    plugins: demo ? [react(), viteSingleFile()] : [react()],
    base: demo ? './' : '/',
    build: demo ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000 } : undefined,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        // The Laravel API (php artisan serve) - same origin for the browser.
        '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  }
})
