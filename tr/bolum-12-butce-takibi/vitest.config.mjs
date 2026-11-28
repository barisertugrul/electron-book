import { defineConfig } from 'vitest/config';

// Testler Electron'u açmadan, düz Node.js ile çalışır.
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
