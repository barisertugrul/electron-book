// document.js — Açık belgeyle ilgili küçük yardımcı fonksiyonlar.
//
// Bu fonksiyonlar Electron'a bağlı değildir; sadece veri alıp veri döndürür.
// Bu sayede Electron'u başlatmadan, düz Node.js ile test edebiliriz.

import path from 'node:path';

export const APP_NAME = 'Hızlı Not';
export const UNTITLED = 'Adsız';

// Dosya yolundan ekranda gösterilecek adı çıkarır.
// "C:\\Notlar\\alisveris.md" -> "alisveris.md"
export function getDisplayName(filePath) {
  if (!filePath) return UNTITLED;
  // Windows yollarını Linux/macOS'ta da doğru ayırmak için iki ayracı da kontrol ederiz.
  return path.win32.basename(path.posix.basename(filePath));
}

// Pencere başlığını üretir. Kaydedilmemiş değişiklik varsa başa "•" koyar.
// Örnek: "• alisveris.md — Hızlı Not"
export function buildWindowTitle(filePath, isDirty) {
  const mark = isDirty ? '• ' : '';
  return `${mark}${getDisplayName(filePath)} — ${APP_NAME}`;
}
