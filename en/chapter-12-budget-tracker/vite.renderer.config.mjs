import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Content Security Policy (CSP, Chapter 6). In the packaged app only our own
// files can run. During development, Vite's "hot reload" feature adds a small
// inline script to the page and listens for file changes over a WebSocket,
// so in development we allow two more things.
const CSP = {
  build: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:",
  serve:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:",
};

function contentSecurityPolicy(command) {
  return {
    name: 'content-security-policy',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP[command] },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), contentSecurityPolicy(command)],
}));
