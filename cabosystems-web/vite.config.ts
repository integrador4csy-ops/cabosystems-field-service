import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Preview servers must not overwrite the app's optimized dependencies.
  cacheDir: fileURLToPath(new URL('./node_modules/.vite-app', import.meta.url)),
  plugins: [react(), tailwindcss()],
})

