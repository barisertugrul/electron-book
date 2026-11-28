import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// İçerik Güvenliği Politikası (CSP, Bölüm 6). Paketlenmiş uygulamada yalnızca
// kendi dosyalarımız çalışır. Geliştirme sırasında ise Vite'ın "sıcak yenileme"
// özelliği sayfaya küçük bir satır içi betik ekler ve bir WebSocket ile dosya
// değişikliklerini dinler; bu yüzden geliştirmede iki izin daha veriyoruz.
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
