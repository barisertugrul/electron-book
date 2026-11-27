// preload.cjs — Üç penceremizin (zamanlayıcı, ayarlar, özet) ortak köprüsü.
//
// Hızlı Not'taki gibi: ipcRenderer'ı sayfaya açmıyoruz, yalnızca
// ihtiyaç duyulan fonksiyonları window.focusTimer altında veriyoruz.

const { contextBridge, ipcRenderer } = require('electron');

// Ana süreçten gelen bir mesajı dinler; sayfaya olay nesnesini değil veriyi verir.
function subscribe(channel, callback) {
  ipcRenderer.on(channel, (_event, data) => callback(data));
}

contextBridge.exposeInMainWorld('focusTimer', {
  // Zamanlayıcı
  getState: () => ipcRenderer.invoke('timer:get-state'),
  toggle: () => ipcRenderer.send('timer:command', 'toggle'),
  reset: () => ipcRenderer.send('timer:command', 'reset'),
  skip: () => ipcRenderer.send('timer:command', 'skip'),
  onState: (callback) => subscribe('timer:state', callback),

  // Ayarlar
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Günlük özet
  getStats: () => ipcRenderer.invoke('stats:get'),
  onStatsChanged: (callback) => subscribe('stats:changed', callback),

  // Pencereler
  openWindow: (name) => ipcRenderer.send('window:open', name),
  closeWindow: () => ipcRenderer.send('window:close'),
});
