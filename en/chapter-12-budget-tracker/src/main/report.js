// report.js — Saves the monthly report as a PDF file.
//
// Every Electron page can use Chromium's printing engine:
// webContents.printToPDF turns the page into a PDF file, like
// "Print > Save as PDF". We open the report in a hidden window, without
// showing it to the user, and print it.

import { app, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DIALOG_TEXT } from '../shared/labels.js';
import { createWindow, loadPage } from './window.js';

// Windows we are waiting on to be ready: webContents.id -> resolve
const waiting = new Map();

// When the report page has loaded its data and drawn it, it sends
// 'report:ready'; ipc.js calls this function.
export function reportReady(webContents) {
  waiting.get(webContents.id)?.();
}

function waitForReady(webContents, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(webContents.id);
      reject(new Error('The report could not be prepared (timed out).'));
    }, timeoutMs);
    waiting.set(webContents.id, () => {
      clearTimeout(timer);
      waiting.delete(webContents.id);
      resolve();
    });
  });
}

export async function exportReportPdf(parent, month) {
  // First we ask where to save it: if the user cancels, we don't prepare the
  // report for nothing.
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: DIALOG_TEXT.savePdf,
    defaultPath: path.join(app.getPath('documents'), `${DIALOG_TEXT.pdfFileName}-${month}.pdf`),
    filters: [{ name: DIALOG_TEXT.pdfFiles, extensions: ['pdf'] }],
  });
  if (canceled) return { canceled: true };

  // An invisible window with A4 paper proportions and a white background.
  const window = createWindow({ show: false, width: 794, height: 1123, backgroundColor: '#ffffff' });
  try {
    const ready = waitForReady(window.webContents);
    await loadPage(window, `report/${month}`);
    await ready;
    const pdf = await window.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true, // Print the colored category dots too
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }, // inches
    });
    await writeFile(filePath, pdf);
    return { filePath };
  } finally {
    window.destroy();
  }
}
