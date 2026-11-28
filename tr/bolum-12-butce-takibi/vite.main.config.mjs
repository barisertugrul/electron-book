import { defineConfig } from 'vite';

// Vite, ana süreç kodunu tek bir dosyada birleştirir (paketler). Node.js'in
// kendi modülleri bu dosyaya kopyalanmaz, çalışırken require ile yüklenir.
// Forge bu listeyi hazır tutar, ama yeni sayılan node:sqlite listede yok;
// onu biz ekliyoruz. Eklemezsek "DatabaseSync is not a constructor" hatası alırız.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:sqlite'],
    },
  },
});
