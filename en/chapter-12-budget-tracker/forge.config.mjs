// forge.config.mjs — Electron Forge settings.
//
// The Vite plugin runs three separate builds: the main process, the preload
// and the renderer (the React UI). Output goes to the .vite/ folder, and the
// "main" field in package.json points at the main process file there.

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
