// preload.js — İşleyiciye açılan köprü: window.budget
//
// Her fonksiyon tek bir IPC kanalına gider. İşleyici ipcRenderer'ın
// kendisine erişemez; yalnızca buradaki fonksiyonları görür.

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

  // Rapor penceresi çizimi bitirince ana sürece haber verir.
  reportReady: () => ipcRenderer.send('report:ready'),
});
