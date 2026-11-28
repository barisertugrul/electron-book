// forge.config.mjs — Electron Forge ayarları.
//
// Vite eklentisi üç ayrı derleme yapar: ana süreç, preload ve işleyici
// (React arayüzü). Çıktılar .vite/ klasörüne yazılır; package.json'daki
// "main" alanı da oradaki ana süreç dosyasını gösterir.

import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

export default {
  packagerConfig: {
    asar: true,
    icon: 'assets/icon',
  },
  makers: [new MakerZIP({})],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
  ],
};
