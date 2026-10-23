import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const mobile = fileURLToPath(new URL('../../../cabosystems-mobile', import.meta.url));
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: here('.'), plugins: [react()],
  resolve: { alias: [
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
  server: { host: '127.0.0.1', port: 5178, strictPort: true, fs: { allow: [here('../../../')] } },
});
