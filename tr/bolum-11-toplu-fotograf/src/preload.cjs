// preload.cjs — Sayfa ile ana süreç arasındaki köprü.
//
// Sayfa yalnızca burada listelenen fonksiyonları görür (window.photoTool).

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Ana süreçten gelen bir mesajı dinler; sayfaya olay nesnesini değil veriyi verir.
function subscribe(channel, callback) {
  ipcRenderer.on(channel, (_event, data) => callback(data));
}

contextBridge.exposeInMainWorld('photoTool', {
  // Sürükle-bırak ile gelen File nesnesinin diskteki yolu. Electron 32'den
  // beri File nesnelerinde "path" alanı yok; yolu webUtils verir.
  pathForFile: (file) => webUtils.getPathForFile(file),

  getState: () => ipcRenderer.invoke('state:get'),
  pickPhotos: () => ipcRenderer.invoke('photos:pick'),
  scan: (paths) => ipcRenderer.invoke('photos:scan', paths),
  removePhoto: (photoPath) => ipcRenderer.invoke('photos:remove', photoPath),
  clearPhotos: () => ipcRenderer.invoke('photos:clear'),

  pickOutput: () => ipcRenderer.invoke('output:pick'),
  openOutput: () => ipcRenderer.invoke('output:open'),

  process: (rules) => ipcRenderer.invoke('photos:process', rules),
  cancel: () => ipcRenderer.send('work:cancel'),

  onScanProgress: (callback) => subscribe('scan:progress', callback),
  onProcessProgress: (callback) => subscribe('process:progress', callback),
});
