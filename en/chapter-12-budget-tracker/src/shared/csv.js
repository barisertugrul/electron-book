// csv.js — Turns transactions into CSV text and reads them back from CSV text.
//
// CSV is a plain text file where each line is a record and the columns are
// split by a separator. Since Excel and Google Sheets can open it, it is the
// export format of banks and many other apps. The functions in this file are
// pure functions: they don't read or write files; they only work with text.

import { CSV, ERRORS, TYPE_LABELS } from './labels.js';
import { formatAmount, isValidDate, parseAmount } from './money.js';

const COLUMNS = ['date', 'type', 'category', 'amount', 'note'];

// Wraps a value containing the separator, a quote or a line break in quotes,
// and doubles the quotes inside: Joe "Pro" -> "Joe ""Pro"""
function quote(value) {
  const text = String(value);
  const needsQuotes = text.includes(CSV.separator) || /["\n\r]/.test(text);
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(transactions) {
  const header = COLUMNS.map((column) => CSV.headers[column]);
  const lines = transactions.map((t) => [
    t.date,
    TYPE_LABELS[t.type],
    t.categoryName,
    formatAmount(t.amount),
    t.note,
  ]);
  // The leading \uFEFF (BOM) tells Excel "this file is UTF-8"; without it,
  // accented characters look broken. Line endings are Windows-style \r\n.
  return '\uFEFF' + [header, ...lines].map((line) => line.map(quote).join(CSV.separator)).join('\r\n') + '\r\n';
}

// Splits CSV text into rows and cells. Separators and line breaks inside
// quotes count as part of the cell. Guesses the separator from the first line:
// Turkish Excel uses ";", English Excel ",".
export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0];
  const separator = firstLine.includes(';') ? ';' : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop completely empty rows.
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

// "28.11.2026" or "2026-11-28" -> "2026-11-28"
function normalizeDate(text) {
  const value = text.trim();
  const dotted = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const date = dotted ? `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}` : value;
  return isValidDate(date) ? date : null;
}

// "Expense", "expense" -> "expense"
function normalizeType(text) {
  const value = text.trim().toLocaleLowerCase();
  return Object.keys(TYPE_LABELS).find(
    (type) => type === value || TYPE_LABELS[type].toLocaleLowerCase() === value,
  );
}

// Turns CSV text into transactions ready to be saved. It doesn't skip
// invalid rows; it lists them with their line numbers, so the user can fix
// the file and try again.
export function csvToTransactions(text) {
  const [header, ...lines] = parseCsv(text);
  if (!header || lines.length === 0) return { rows: [], errors: [ERRORS.csvEmpty] };

  // The columns may be in a different order; we find them by header name.
  const names = header.map((name) => name.trim().toLocaleLowerCase());
  const index = Object.fromEntries(
    COLUMNS.map((column) => [column, names.indexOf(CSV.headers[column].toLocaleLowerCase())]),
  );
  if (['date', 'type', 'category', 'amount'].some((column) => index[column] === -1)) {
    return { rows: [], errors: [ERRORS.csvHeader] };
  }

  const rows = [];
  const errors = [];
  lines.forEach((cells, position) => {
    const line = position + 2; // Line 1 is the header
    const cell = (column) => (index[column] === -1 ? '' : (cells[index[column]] ?? '').trim());
    const date = normalizeDate(cell('date'));
    const type = normalizeType(cell('type'));
    const amount = parseAmount(cell('amount'));
    const categoryName = cell('category');

    if (!date) errors.push(ERRORS.csvLine(line, ERRORS.invalidDate));
    else if (!type) errors.push(ERRORS.csvLine(line, ERRORS.invalidType));
    else if (!amount) errors.push(ERRORS.csvLine(line, ERRORS.invalidAmount));
    else if (!categoryName) errors.push(ERRORS.csvLine(line, ERRORS.invalidCategory));
    else rows.push({ date, type, amount, categoryName, note: cell('note').slice(0, 200) });
  });
  return { rows, errors };
}
