// window.js — Pencere oluşturma ve sayfa yükleme.
//
// Ana pencere de PDF raporu için açılan gizli pencere de buradaki ayarlarla
// oluşur; böylece güvenlik ayarlarını tek yerde tutarız.

import { BrowserWindow, app, nativeTheme } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { APP_NAME } from '../shared/labels.js';

// Vite eklentisi bu iki değeri derleme sırasında doldurur. Geliştirirken
// (npm start) sayfa Vite'ın sunucusundan gelir; paketlenmiş uygulamada
// diskteki index.html dosyasından.
// (__dirname, derlenmiş dosyanın bulunduğu .vite/build klasörüdür.)
const DEV_SERVER_URL = MAIN_WINDOW_VITE_DEV_SERVER_URL;
const PAGE_FILE = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
const PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON = path.join(app.getAppPath(), 'assets', 'icon.png');

// Arayüzün adresi. IPC'de "bu isteği bizim sayfamız mı gönderdi?" diye
// bakarken de kullanılır.
export const PAGE_URL = DEV_SERVER_URL ? new URL(DEV_SERVER_URL).href : pathToFileURL(PAGE_FILE).href;

// Sayfayı yükler. route, adresin # işaretinden sonraki kısmıdır:
// "report/2026-11" -> rapor sayfası (PDF için gizli pencerede açılır).
export function loadPage(window, route = '') {
  return DEV_SERVER_URL
    ? window.loadURL(`${DEV_SERVER_URL}#/${route}`)
    : window.loadFile(PAGE_FILE, { hash: `/${route}` });
}

// Ana pencere ve rapor penceresi aynı güvenlik ayarlarını kullanır.
export function createWindow(options = {}) {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    icon: ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1e22' : '#f6f6f4',
    webPreferences: { preload: PRELOAD }, // contextIsolation ve sandbox varsayılan olarak açık
    ...options,
  });

  // Sayfa başka bir adrese gidemez, yeni pencere açamaz. Dış bağlantılar
  // bu uygulamada yok; olsaydı shell.openExternal ile tarayıcıda açardık.
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return window;
}
