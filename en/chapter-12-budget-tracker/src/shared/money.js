// money.js — Money and date helpers.
//
// We store amounts in the database in CENTS, as whole numbers:
// $1,250.50 -> 125050. Why? When adding decimal numbers, JavaScript makes
// small rounding errors (0.1 + 0.2 = 0.30000000000000004). Whole numbers
// don't have this problem; we only divide by 100 when showing them.

import { CURRENCY, DECIMAL_SEPARATOR, LOCALE } from './labels.js';

const currencyFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const wholeFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// 125050 -> "$1,250.50"; with { whole: true }, no cents: "$1,251"
export function formatMoney(cents, { whole = false } = {}) {
  return (whole ? wholeFormat : currencyFormat).format(cents / 100);
}

// 125050 -> "1250.50". Used when editing in the form and in CSV: no
// thousands separator, decimal separator in the book's language.
export function formatAmount(cents) {
  return (cents / 100).toFixed(2).replace('.', DECIMAL_SEPARATOR);
}

// Converts the amount the user typed to cents: "1,250.50" -> 125050.
// Returns null if it is invalid.
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

// --- Dates ------------------------------------------------------------------
// We store dates as text in the "2026-11-28" format. Sorted alphabetically,
// this format is also in date order, and there are no time zone worries.

const pad = (number) => String(number).padStart(2, '0');

// Today's date, in local time: "2026-11-28"
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "2026-11-28" -> "2026-11"
export function monthOf(date) {
  return date.slice(0, 7);
}

// Moves a month key forward or back: ("2026-01", -1) -> "2025-12"
export function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}

// "2026-11" -> "November 2026"
export function monthName(month, style = 'long') {
  const [year, monthNumber] = month.split('-').map(Number);
  const options = style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' };
  return new Intl.DateTimeFormat(LOCALE, options).format(new Date(year, monthNumber - 1, 1));
}

// "2026-11-28" -> "11/28/26"
export function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short' }).format(new Date(year, month - 1, day));
}

// Is this a day that really exists in the calendar? ("2026-02-30" is not.)
export function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const check = new Date(year, month - 1, day);
  return check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day;
}
