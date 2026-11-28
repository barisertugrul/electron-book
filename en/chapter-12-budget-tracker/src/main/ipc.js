// ipc.js — All the channels the UI can use.
//
// Each channel is a thin shell around a function in budget-store. Two jobs
// are done here: checking that the request came from our own page, and
// checking the types of the incoming values.

import { app, dialog, ipcMain, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { csvToTransactions, toCsv } from '../shared/csv.js';
import { DIALOG_TEXT } from '../shared/labels.js';
import { today } from '../shared/money.js';
import { exportReportPdf, reportReady } from './report.js';
import { PAGE_URL } from './window.js';

// We drop the # and ? parts from the sending frame's address and compare it
// with our page. (The report window's address ends with "#/report/...".)
function isTrusted(frame) {
  if (!frame) return false;
  const url = new URL(frame.url);
  url.hash = '';
  url.search = '';
  return url.href === PAGE_URL;
}

// On error the renderer gets { error: "message" }; it shows that to the
// user (src/renderer/api.js).
function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrusted(event.senderFrame)) throw new Error(`Untrusted sender: ${channel}`);
    try {
      return await listener(...args);
    } catch (error) {
      return { error: error.message };
    }
  });
}

// --- Checking incoming values ------------------------------------------------

function id(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error('Invalid record id');
  return value;
}

function month(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Invalid month');
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
  let lastSavedFile = null; // The CSV or PDF the user saved last

  handle('categories:list', () => store.listCategories());
  handle('categories:add', (input) => store.addCategory(input));
  handle('categories:update', (categoryId, input) => store.updateCategory(id(categoryId), input));
  handle('categories:delete', (categoryId) => store.deleteCategory(id(categoryId)));

  handle('transactions:list', (value) => store.listTransactions(filter(value)));
  handle('transactions:add', (input) => store.addTransaction(input));
  handle('transactions:update', (transactionId, input) => store.updateTransaction(id(transactionId), input));

  // The main process asks for the delete confirmation: a bug or a malicious
  // script in the renderer cannot delete records without asking the user.
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
    if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new Error('Invalid year');
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
    // If the file has even one invalid row, we add nothing; undoing a
    // half-finished import is hard for the user.
    if (errors.length > 0) return { errors };
    return store.importTransactions(rows);
  });

  // --- PDF report ----------------------------------------------------------------

  handle('report:pdf', async (value) => {
    const result = await exportReportPdf(getWindow(), month(value));
    if (result.filePath) lastSavedFile = result.filePath;
    return result;
  });

  // The hidden report window says "I'm ready" (send/on: a message that expects no reply).
  ipcMain.on('report:ready', (event) => {
    if (isTrusted(event.senderFrame)) reportReady(event.sender);
  });

  // The renderer cannot send a path; it can only show the file saved last.
  handle('files:show-last', () => lastSavedFile && shell.showItemInFolder(lastSavedFile));
}
