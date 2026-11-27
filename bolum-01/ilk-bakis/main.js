// Bölüm 1 — Electron'a ilk bakış
// Bu dosya ANA SÜREÇTE (main process) çalışır: Node.js burada kullanılabilir.
// Kodun ayrıntılarını Bölüm 3'te satır satır inceleyeceğiz.

import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function pencereyiOlustur() {
  const pencere = new BrowserWindow({
    width: 720,
    height: 480,
    title: 'Electron\'a İlk Bakış',
  });

  // Pencerenin içinde bir web sayfası açılır. Bu sayfa İŞLEYİCİ SÜREÇTE
  // (renderer process) çalışır: içinde Chromium vardır, Node.js yoktur.
  pencere.loadFile(path.join(import.meta.dirname, 'index.html'));
}

// Electron'un hazır olmasını bekleyip penceremizi açıyoruz.
app.whenReady().then(() => {
  // Uçbirime (terminal) yazılan bu satırlar ana süreçten gelir.
  console.log('Electron sürümü :', process.versions.electron);
  console.log('Chromium sürümü :', process.versions.chrome);
  console.log('Node.js sürümü  :', process.versions.node);

  pencereyiOlustur();
});

// Tüm pencereler kapanınca uygulamadan çık (macOS farkını Bölüm 3'te ele alacağız).
app.on('window-all-closed', () => {
  app.quit();
});
