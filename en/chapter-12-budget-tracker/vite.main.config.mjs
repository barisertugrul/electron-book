import { defineConfig } from 'vite';

// Vite combines (bundles) the main process code into a single file. Node.js's
// own modules are not copied into that file; they are loaded with require at
// run time. Forge keeps a ready-made list of them, but the fairly new
// node:sqlite is missing from it, so we add it ourselves. Without this line
// we get a "DatabaseSync is not a constructor" error.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:sqlite'],
    },
  },
});
