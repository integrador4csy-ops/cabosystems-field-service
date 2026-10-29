import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  cacheDir: fileURLToPath(new URL('../../node_modules/.vite-task-workspace-preview', import.meta.url)),
  root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: /.*lib\/taskReportsApi$/, replacement: fileURLToPath(new URL('./reportsApi.ts', import.meta.url)) },
    { find: /.*lib\/taskTemplatesApi$/, replacement: fileURLToPath(new URL('./templatesApi.ts', import.meta.url)) },
    { find: /.*context\/AdminAuthContext$/, replacement: fileURLToPath(new URL('../agenda-preview/auth.ts', import.meta.url)) },
    { find: /.*lib\/projectsApi$/, replacement: fileURLToPath(new URL('./api.ts', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5179, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] } },
});
