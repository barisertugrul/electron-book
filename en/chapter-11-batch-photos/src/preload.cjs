// preload.cjs — The bridge between the page and the main process.
//
// The page sees only the functions listed here (window.photoTool).

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Listens to a message from the main process; gives the page the data, not the event object.
function subscribe(channel, callback) {
  ipcRenderer.on(channel, (_event, data) => callback(data));
}

contextBridge.exposeInMainWorld('photoTool', {
  // The path on disk of a File object that came from drag and drop. Since
  // Electron 32, File objects have no "path" field; webUtils gives the path.
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
