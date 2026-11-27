// preload.cjs — The shared bridge of our three windows (timer, settings, summary).
//
// As in Quick Note: we don't expose ipcRenderer to the page, only the
// functions it needs, under window.focusTimer.

const { contextBridge, ipcRenderer } = require('electron');

// Listens for a message from the main process; gives the page the data, not the event object.
function subscribe(channel, callback) {
  ipcRenderer.on(channel, (_event, data) => callback(data));
}

contextBridge.exposeInMainWorld('focusTimer', {
  // Timer
  getState: () => ipcRenderer.invoke('timer:get-state'),
  toggle: () => ipcRenderer.send('timer:command', 'toggle'),
  reset: () => ipcRenderer.send('timer:command', 'reset'),
  skip: () => ipcRenderer.send('timer:command', 'skip'),
  onState: (callback) => subscribe('timer:state', callback),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Daily summary
  getStats: () => ipcRenderer.invoke('stats:get'),
  onStatsChanged: (callback) => subscribe('stats:changed', callback),

  // Windows
  openWindow: (name) => ipcRenderer.send('window:open', name),
  closeWindow: () => ipcRenderer.send('window:close'),
});
