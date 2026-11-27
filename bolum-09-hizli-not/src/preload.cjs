// preload.cjs — Ana süreç ile işleyici süreç arasındaki güvenli köprü.
//
// Bu betik sayfa yüklenmeden önce, yalıtılmış bir bağlamda çalışır.
// contextBridge ile sayfaya yalnızca ihtiyaç duyduğu fonksiyonları açarız;
// ipcRenderer nesnesinin kendisini ASLA açmayız.
//
// Neden .cjs? Sandbox açıkken preload betikleri ES modülü olamaz,
// bu yüzden yalnızca bu dosyada require() kullanıyoruz.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hizliNot', {
  // İstek-yanıt (invoke/handle): her biri bir Promise döndürür.
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content) => ipcRenderer.invoke('file:save', content),
  saveFileAs: (content) => ipcRenderer.invoke('file:save-as', content),
  renderMarkdown: (text) => ipcRenderer.invoke('markdown:render', text),
  confirmUnsaved: () => ipcRenderer.invoke('dialog:confirm-unsaved'),

  // Tek yönlü bildirimler (send/on): cevap beklenmez.
  setDirty: (isDirty) => ipcRenderer.send('document:set-dirty', isDirty),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Ana süreçten gelen mesajları dinlemek için.
  // Sayfaya olay nesnesini (event) değil, sadece veriyi veriyoruz.
  onMenuCommand: (callback) => {
    ipcRenderer.on('menu:command', (_event, command) => callback(command));
  },
  onCloseRequested: (callback) => {
    ipcRenderer.on('app:close-requested', () => callback());
  },
});
