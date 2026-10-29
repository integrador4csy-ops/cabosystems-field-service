import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const mobile = fileURLToPath(new URL('../../../cabosystems-mobile', import.meta.url));
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  cacheDir: here('../../node_modules/.vite-mobile-event-preview'),
  root: here('.'), plugins: [react()],
  resolve: { alias: [
    { find: 'expo-crypto', replacement: here('./stubs.tsx') },
    { find: 'expo-status-bar', replacement: here('./stubs.tsx') },
    { find: '@/lib/companyAgendaApi', replacement: here('./stubs.tsx') },
    { find: 'lucide-react-native', replacement: here('../../node_modules/lucide-react') },
    { find: '@/components/HeaderCaboSystems', replacement: here('./stubs.tsx') },
    { find: '@/lib/i18n', replacement: here('./stubs.tsx') },
    { find: 'react-native-safe-area-context', replacement: here('./stubs.tsx') },
    { find: /^react-native$/, replacement: `${mobile}/node_modules/react-native-web` },
    { find: '@', replacement: mobile },
    { find: /^react$/, replacement: `${mobile}/node_modules/react` },
    { find: /^react-dom(.*)$/, replacement: `${mobile}/node_modules/react-dom$1` },
    { find: /^react-native-svg$/, replacement: `${mobile}/node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js` },
  ] },
  server: { host: '127.0.0.1', port: 5182, strictPort: true, fs: { allow: [here('../../../')] } },
});
