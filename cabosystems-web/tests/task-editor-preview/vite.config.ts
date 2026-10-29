import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  cacheDir: fileURLToPath(new URL('../../node_modules/.vite-task-editor-preview', import.meta.url)),
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: /.*lib\/projectsApi$/, replacement: fileURLToPath(new URL('./api.ts', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 5178, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
});
