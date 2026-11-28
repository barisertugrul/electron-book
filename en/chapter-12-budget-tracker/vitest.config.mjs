import { defineConfig } from 'vitest/config';

// Tests run on plain Node.js, without starting Electron.
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
