// report.js — Aylık raporu PDF dosyası olarak kaydeder.
//
// Electron'un her sayfası Chromium'un yazdırma motorunu kullanabilir:
// webContents.printToPDF sayfayı, "Yazdır > PDF olarak kaydet" gibi bir PDF
// dosyasına çevirir. Raporu kullanıcıya göstermeden, gizli bir pencerede
// açıp yazdırıyoruz.

import { app, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DIALOG_TEXT } from '../shared/labels.js';
import { createWindow, loadPage } from './window.js';

// Hazır olmasını beklediğimiz pencereler: webContents.id -> resolve
const waiting = new Map();

// Rapor sayfası verisini alıp çizdiğinde 'report:ready' gönderir; ipc.js
// bu fonksiyonu çağırır.
export function reportReady(webContents) {
  waiting.get(webContents.id)?.();
}

function waitForReady(webContents, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(webContents.id);
      reject(new Error('Rapor hazırlanamadı (zaman aşımı).'));
    }, timeoutMs);
    waiting.set(webContents.id, () => {
      clearTimeout(timer);
      waiting.delete(webContents.id);
      resolve();
    });
  });
}

export async function exportReportPdf(parent, month) {
  // Önce nereye kaydedileceğini soruyoruz: kullanıcı vazgeçerse boşuna
  // rapor hazırlamayalım.
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: DIALOG_TEXT.savePdf,
    defaultPath: path.join(app.getPath('documents'), `${DIALOG_TEXT.pdfFileName}-${month}.pdf`),
    filters: [{ name: DIALOG_TEXT.pdfFiles, extensions: ['pdf'] }],
  });
  if (canceled) return { canceled: true };

  // A4 kağıt oranında, ekranda görünmeyen, zemini beyaz bir pencere.
  const window = createWindow({ show: false, width: 794, height: 1123, backgroundColor: '#ffffff' });
  try {
    const ready = waitForReady(window.webContents);
    await loadPage(window, `report/${month}`);
    await ready;
    const pdf = await window.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true, // Renkli kategori noktaları da basılsın
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }, // inç
    });
    await writeFile(filePath, pdf);
    return { filePath };
  } finally {
    window.destroy();
  }
}
