// main.js — Bütçe Takibi'nin ana süreci.
//
// Veritabanını açar, IPC kanallarını kaydeder ve pencereyi gösterir.
// Veritabanına YALNIZCA ana süreç dokunur; React arayüzü veriyi preload
// köprüsü üzerinden ister (Bölüm 6'daki güvenli şablon).

import { app, Menu } from 'electron';
import path from 'node:path';

import { LOCALE } from '../shared/labels.js';
import { createBudgetStore } from './budget-store.js';
import { openDatabase } from './database.js';
import { registerIpcHandlers } from './ipc.js';
import { createWindow, loadPage } from './window.js';

let mainWindow = null;

// Tarih kutusu (input type="date") gibi Chromium'un çizdiği parçalar
// kitabın dilinde görünsün: 28.11.2026. Bu ayar app hazır olmadan yapılmalı.
app.commandLine.appendSwitch('lang', LOCALE);

app.whenReady().then(() => {
  // Veritabanı dosyası kullanıcı verisi klasöründe durur; Windows'ta
  // C:\Users\<ad>\AppData\Roaming\Bütçe Takibi\budget.sqlite
  const db = openDatabase(path.join(app.getPath('userData'), 'budget.sqlite'));
  const store = createBudgetStore(db);

  Menu.setApplicationMenu(null);
  registerIpcHandlers(store, () => mainWindow);

  mainWindow = createWindow();
  loadPage(mainWindow);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Uygulama kapanırken veritabanını düzgünce kapat.
  app.on('will-quit', () => db.close());
});

app.on('window-all-closed', () => {
  app.quit();
});
