// csv.js — İşlemleri CSV metnine çevirir ve CSV metninden geri okur.
//
// CSV, her satırı bir kayıt, sütunları bir ayırıcıyla bölünmüş düz bir metin
// dosyasıdır. Excel ve Google E-Tablolar ile açılabildiği için bankaların ve
// başka uygulamaların dışa aktarma biçimidir. Bu dosyadaki fonksiyonlar saf
// fonksiyonlardır: dosya okumaz, yazmaz; yalnızca metinle çalışır.

import { CSV, ERRORS, TYPE_LABELS } from './labels.js';
import { formatAmount, isValidDate, parseAmount } from './money.js';

const COLUMNS = ['date', 'type', 'category', 'amount', 'note'];

// Ayırıcı, tırnak ya da satır sonu içeren değeri tırnak içine alır;
// içindeki tırnakları da ikiler: Ali "Usta" -> "Ali ""Usta"""
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
  // Baştaki \uFEFF (BOM), Excel'e "bu dosya UTF-8" der; yoksa Türkçe
  // karakterler bozuk görünür. Satır sonu Windows usulü \r\n.
  return '\uFEFF' + [header, ...lines].map((line) => line.map(quote).join(CSV.separator)).join('\r\n') + '\r\n';
}

// CSV metnini satır ve hücrelere böler. Tırnak içindeki ayırıcıları ve satır
// sonlarını hücrenin parçası sayar. Ayırıcıyı ilk satırdan tahmin eder: Türkçe
// Excel ";" kullanır, İngilizce Excel ",".
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
  // Tamamen boş satırları at.
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

// "28.11.2026" ya da "2026-11-28" -> "2026-11-28"
function normalizeDate(text) {
  const value = text.trim();
  const dotted = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const date = dotted ? `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}` : value;
  return isValidDate(date) ? date : null;
}

// "Gider", "gider", "expense" -> "expense"
function normalizeType(text) {
  const value = text.trim().toLocaleLowerCase();
  return Object.keys(TYPE_LABELS).find(
    (type) => type === value || TYPE_LABELS[type].toLocaleLowerCase() === value,
  );
}

// CSV metnini kaydedilmeye hazır işlemlere çevirir. Hatalı satırları
// atlamaz, satır numarasıyla birlikte listeler: kullanıcı dosyasını
// düzeltip yeniden dener.
export function csvToTransactions(text) {
  const [header, ...lines] = parseCsv(text);
  if (!header || lines.length === 0) return { rows: [], errors: [ERRORS.csvEmpty] };

  // Sütunların sırası farklı olabilir; başlık adından buluruz.
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
    const line = position + 2; // 1. satır başlık
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
