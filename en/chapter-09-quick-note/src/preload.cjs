// preload.cjs — The secure bridge between the main and renderer processes.
//
// This script runs before the page loads, in an isolated context.
// With contextBridge we expose only the functions the page needs;
// we NEVER expose the ipcRenderer object itself.
//
// Why .cjs? With the sandbox on, preload scripts cannot be ES modules,
// so this is the only file where we use require().

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickNote', {
  // Request-response (invoke/handle): each one returns a Promise.
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content) => ipcRenderer.invoke('file:save', content),
  saveFileAs: (content) => ipcRenderer.invoke('file:save-as', content),
  renderMarkdown: (text) => ipcRenderer.invoke('markdown:render', text),
  confirmUnsaved: () => ipcRenderer.invoke('dialog:confirm-unsaved'),

  // One-way notifications (send/on): no reply is expected.
  setDirty: (isDirty) => ipcRenderer.send('document:set-dirty', isDirty),
  closeWindow: () => ipcRenderer.send('window:close'),

  // For listening to messages coming from the main process.
  // We give the page only the data, not the event object.
  onMenuCommand: (callback) => {
    ipcRenderer.on('menu:command', (_event, command) => callback(command));
  },
  onCloseRequested: (callback) => {
    ipcRenderer.on('app:close-requested', () => callback());
  },
});
