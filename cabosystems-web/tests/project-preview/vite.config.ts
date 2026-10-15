import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Separate, opt-in test server. Never imported by the production app.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: /.*context\/AdminAuthContext$/, replacement: fileURLToPath(new URL('./auth.ts', import.meta.url)) },
    { find: /.*lib\/projectAccessApi$/, replacement: fileURLToPath(new URL('./api.ts', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5175, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
});
