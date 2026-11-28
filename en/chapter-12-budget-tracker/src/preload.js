// preload.js — The bridge opened to the renderer: window.budget
//
// Each function goes to a single IPC channel. The renderer cannot reach
// ipcRenderer itself; it only sees the functions here.

import { contextBridge, ipcRenderer } from 'electron';

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('budget', {
  listCategories: invoke('categories:list'),
  addCategory: invoke('categories:add'),
  updateCategory: invoke('categories:update'),
  deleteCategory: invoke('categories:delete'),

  listTransactions: invoke('transactions:list'),
  addTransaction: invoke('transactions:add'),
  updateTransaction: invoke('transactions:update'),
  deleteTransaction: invoke('transactions:delete'),

  monthSummary: invoke('summary:month'),
  yearTotals: invoke('summary:year'),

  exportCsv: invoke('csv:export'),
  importCsv: invoke('csv:import'),
  savePdf: invoke('report:pdf'),
  showLastFile: invoke('files:show-last'),

  // The report window tells the main process when it has finished drawing.
  reportReady: () => ipcRenderer.send('report:ready'),
});
