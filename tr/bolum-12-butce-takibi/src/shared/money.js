// money.js — Para ve tarih yardımcıları.
//
// Tutarları veritabanında KURUŞ olarak, tam sayı biçiminde saklıyoruz:
// 1.250,50 TL -> 125050. Neden? Ondalıklı sayılarla toplama yapınca
// JavaScript küçük yuvarlama hataları yapar (0.1 + 0.2 = 0.30000000000000004).
// Tam sayılarda bu sorun yoktur; yalnızca ekranda gösterirken 100'e böleriz.

import { CURRENCY, DECIMAL_SEPARATOR, LOCALE } from './labels.js';

const currencyFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const wholeFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// 125050 -> "₺1.250,50"; { whole: true } ile kuruşsuz: "₺1.251"
export function formatMoney(cents, { whole = false } = {}) {
  return (whole ? wholeFormat : currencyFormat).format(cents / 100);
}

// 125050 -> "1250,50". Formda düzenlerken ve CSV'de kullanılır: binlik
// ayırıcı yok, ondalık ayırıcı kitabın dilinde.
export function formatAmount(cents) {
  return (cents / 100).toFixed(2).replace('.', DECIMAL_SEPARATOR);
}

// Kullanıcının yazdığı tutarı kuruşa çevirir: "1.250,50" -> 125050.
// Geçersizse null döner.
export function parseAmount(text) {
  const thousands = DECIMAL_SEPARATOR === ',' ? '.' : ',';
  const clean = String(text)
    .replace(/[\s₺$€£]/g, '')
    .replaceAll(thousands, '')
    .replace(DECIMAL_SEPARATOR, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

// --- Tarihler --------------------------------------------------------------
// Tarihleri "2026-11-28" biçiminde metin olarak saklıyoruz. Bu biçim
// alfabetik sıralandığında tarih sırasına da girer ve saat dilimi derdi yoktur.

const pad = (number) => String(number).padStart(2, '0');

// Bugünün tarihi, yerel saatle: "2026-11-28"
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "2026-11-28" -> "2026-11"
export function monthOf(date) {
  return date.slice(0, 7);
}

// Ay anahtarını ileri ya da geri kaydırır: ("2026-01", -1) -> "2025-12"
export function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}

// "2026-11" -> "Kasım 2026"
export function monthName(month, style = 'long') {
  const [year, monthNumber] = month.split('-').map(Number);
  const options = style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' };
  return new Intl.DateTimeFormat(LOCALE, options).format(new Date(year, monthNumber - 1, 1));
}

// "2026-11-28" -> "28.11.2026"
export function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short' }).format(new Date(year, month - 1, day));
}

// Takvimde gerçekten var olan bir gün mü? ("2026-02-30" değil.)
export function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const check = new Date(year, month - 1, day);
  return check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day;
}
