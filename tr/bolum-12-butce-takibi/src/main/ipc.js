// ipc.js — Arayüzün kullanabileceği bütün kanallar.
//
// Her kanal, budget-store'daki bir fonksiyonun ince bir kabuğudur. Burada
// iki iş yapılır: isteğin bizim sayfamızdan geldiğini denetlemek ve
// gelen değerlerin türünü kontrol etmek.

import { app, dialog, ipcMain, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { csvToTransactions, toCsv } from '../shared/csv.js';
import { DIALOG_TEXT } from '../shared/labels.js';
import { today } from '../shared/money.js';
import { exportReportPdf, reportReady } from './report.js';
import { PAGE_URL } from './window.js';

// Gönderen çerçevenin adresinden # ve ? kısmını atıp bizim sayfamızla
// karşılaştırırız. (Rapor penceresinin adresi "#/report/..." ile biter.)
function isTrusted(frame) {
  if (!frame) return false;
  const url = new URL(frame.url);
  url.hash = '';
  url.search = '';
  return url.href === PAGE_URL;
}

// Hata olursa işleyiciye { error: "mesaj" } döner; işleyici bunu
// kullanıcıya gösterir (src/renderer/api.js).
function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrusted(event.senderFrame)) throw new Error(`Güvenilmeyen gönderici: ${channel}`);
    try {
      return await listener(...args);
    } catch (error) {
      return { error: error.message };
    }
  });
}

// --- Gelen değerlerin denetimi -----------------------------------------------

function id(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error('Geçersiz kayıt numarası');
  return value;
}

function month(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Geçersiz ay');
  return value;
}

function filter(value) {
  const { month: m, type, categoryId, search } = value ?? {};
  return {
    month: m ? month(m) : undefined,
    type,
    categoryId,
    search: typeof search === 'string' ? search.slice(0, 100) : undefined,
  };
}

export function registerIpcHandlers(store, getWindow) {
  let lastSavedFile = null; // Kullanıcının en son kaydettiği CSV ya da PDF

  handle('categories:list', () => store.listCategories());
  handle('categories:add', (input) => store.addCategory(input));
  handle('categories:update', (categoryId, input) => store.updateCategory(id(categoryId), input));
  handle('categories:delete', (categoryId) => store.deleteCategory(id(categoryId)));

  handle('transactions:list', (value) => store.listTransactions(filter(value)));
  handle('transactions:add', (input) => store.addTransaction(input));
  handle('transactions:update', (transactionId, input) => store.updateTransaction(id(transactionId), input));

  // Silme onayını ana süreç sorar: işleyicideki bir hata ya da kötü niyetli
  // bir betik, kullanıcıya sormadan kayıt silemez.
  handle('transactions:delete', async (transactionId) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'warning',
      title: DIALOG_TEXT.deleteTitle,
      message: DIALOG_TEXT.deleteMessage,
      buttons: DIALOG_TEXT.deleteButtons,
      defaultId: 1,
      cancelId: 1,
    });
    if (response !== 0) return { deleted: false };
    store.deleteTransaction(id(transactionId));
    return { deleted: true };
  });

  handle('summary:month', (value) => store.monthSummary(month(value)));
  handle('summary:year', (year) => {
    if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new Error('Geçersiz yıl');
    return store.yearTotals(year);
  });

  // --- CSV ---------------------------------------------------------------------

  handle('csv:export', async (value) => {
    const rows = store.listTransactions(filter(value));
    const suffix = value?.month ?? today();
    const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
      title: DIALOG_TEXT.exportCsv,
      defaultPath: path.join(app.getPath('documents'), `${DIALOG_TEXT.csvFileName}-${suffix}.csv`),
      filters: [{ name: DIALOG_TEXT.csvFiles, extensions: ['csv'] }],
    });
    if (canceled) return { canceled: true };
    await writeFile(filePath, toCsv(rows), 'utf8');
    lastSavedFile = filePath;
    return { count: rows.length, filePath };
  });

  handle('csv:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
      title: DIALOG_TEXT.importCsv,
      properties: ['openFile'],
      filters: [{ name: DIALOG_TEXT.csvFiles, extensions: ['csv', 'txt'] }],
    });
    if (canceled) return { canceled: true };
    const { rows, errors } = csvToTransactions(await readFile(filePaths[0], 'utf8'));
    // Dosyada tek bir hatalı satır bile varsa hiçbir şey eklemiyoruz;
    // yarım kalmış bir içe aktarmayı geri almak kullanıcı için zordur.
    if (errors.length > 0) return { errors };
    return store.importTransactions(rows);
  });

  // --- PDF rapor -----------------------------------------------------------------

  handle('report:pdf', async (value) => {
    const result = await exportReportPdf(getWindow(), month(value));
    if (result.filePath) lastSavedFile = result.filePath;
    return result;
  });

  // Gizli rapor penceresi "hazırım" der (send/on: cevap beklemeyen haber).
  ipcMain.on('report:ready', (event) => {
    if (isTrusted(event.senderFrame)) reportReady(event.sender);
  });

  // İşleyici bir yol gönderemez; yalnızca son kaydedilen dosyayı gösterebilir.
  handle('files:show-last', () => lastSavedFile && shell.showItemInFolder(lastSavedFile));
}
