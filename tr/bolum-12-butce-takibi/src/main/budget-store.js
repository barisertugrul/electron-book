// budget-store.js — Bütçe verisinin bütün okuma ve yazma işleri.
//
// Uygulamanın geri kalanı SQL bilmez; yalnızca bu dosyadaki fonksiyonları
// çağırır. Böylece veritabanını değiştirmek ya da test etmek kolaylaşır:
// testler createBudgetStore'a bellekteki bir veritabanı verir (Bölüm 12.8).

import { ERRORS } from '../shared/labels.js';
import { isValidDate } from '../shared/money.js';
import { inTransaction } from './database.js';

const TYPES = ['income', 'expense'];
const NOTE_LIMIT = 200;

export function createBudgetStore(db) {
  // --- Doğrulama ------------------------------------------------------------
  // İşleyiciden gelen her veriyi kaydetmeden önce burada denetleriz. Formdaki
  // denetimler kullanıcıya kolaylık içindir; asıl kapı burasıdır.

  function findCategory(id) {
    return db.prepare('SELECT id, name, type, color FROM categories WHERE id = ?').get(id);
  }

  function validateTransaction(input) {
    const { date, type, amount, categoryId, note = '' } = input ?? {};
    if (!isValidDate(date)) throw new Error(ERRORS.invalidDate);
    if (!TYPES.includes(type)) throw new Error(ERRORS.invalidType);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(ERRORS.invalidAmount);
    const category = Number.isInteger(categoryId) ? findCategory(categoryId) : undefined;
    if (!category || category.type !== type) throw new Error(ERRORS.invalidCategory);
    if (typeof note !== 'string' || note.length > NOTE_LIMIT) throw new Error(ERRORS.noteTooLong);
    return { date, type, amount, categoryId, note: note.trim() };
  }

  function validateCategory(input) {
    const name = String(input?.name ?? '').trim();
    if (!name) throw new Error(ERRORS.categoryName);
    const color = /^#[0-9a-f]{6}$/i.test(input?.color) ? input.color : '#8a8f98';
    return { name, color };
  }

  // --- Kategoriler ----------------------------------------------------------

  function listCategories() {
    return db
      .prepare(
        `SELECT c.id, c.name, c.type, c.color, COUNT(t.id) AS usage
           FROM categories c
           LEFT JOIN transactions t ON t.category_id = c.id
          GROUP BY c.id
          ORDER BY c.type DESC, c.name COLLATE NOCASE`,
      )
      .all();
  }

  function addCategory(input) {
    const { name, color } = validateCategory(input);
    if (!TYPES.includes(input?.type)) throw new Error(ERRORS.invalidType);
    try {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
        .run(name, input.type, color);
      return Number(lastInsertRowid);
    } catch (error) {
      // UNIQUE (name, type) kuralı aynı adı ikinci kez eklemeyi engeller.
      if (error.message.includes('UNIQUE')) throw new Error(ERRORS.categoryExists);
      throw error;
    }
  }

  function updateCategory(id, input) {
    const { name, color } = validateCategory(input);
    try {
      const { changes } = db
        .prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
        .run(name, color, id);
      if (changes === 0) throw new Error(ERRORS.notFound);
    } catch (error) {
      if (error.message.includes('UNIQUE')) throw new Error(ERRORS.categoryExists);
      throw error;
    }
  }

  function deleteCategory(id) {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?').get(id);
    if (count > 0) throw new Error(ERRORS.categoryInUse);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }

  // --- İşlemler -------------------------------------------------------------

  // filter: { month: "2026-11", type: "expense", categoryId: 4, search: "kira" }
  // Boş bırakılan alan filtrelenmez. SQL'i parça parça kuruyoruz ama
  // değerleri asla metne yapıştırmıyoruz: hepsi "?" yerine ayrıca gönderilir.
  function listTransactions(filter = {}) {
    const where = [];
    const values = [];
    if (filter.month) {
      where.push('t.date LIKE ?');
      values.push(`${filter.month}-%`);
    }
    if (TYPES.includes(filter.type)) {
      where.push('t.type = ?');
      values.push(filter.type);
    }
    if (Number.isInteger(filter.categoryId)) {
      where.push('t.category_id = ?');
      values.push(filter.categoryId);
    }
    if (filter.search) {
      where.push('(t.note LIKE ? OR c.name LIKE ?)');
      values.push(`%${filter.search}%`, `%${filter.search}%`);
    }
    const sql = `
      SELECT t.id, t.date, t.type, t.amount, t.note,
             t.category_id AS categoryId, c.name AS categoryName, c.color AS categoryColor
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY t.date DESC, t.id DESC`;
    return db.prepare(sql).all(...values);
  }

  function addTransaction(input) {
    const t = validateTransaction(input);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO transactions (date, type, amount, category_id, note) VALUES (?, ?, ?, ?, ?)')
      .run(t.date, t.type, t.amount, t.categoryId, t.note);
    return Number(lastInsertRowid);
  }

  function updateTransaction(id, input) {
    const t = validateTransaction(input);
    const { changes } = db
      .prepare('UPDATE transactions SET date = ?, type = ?, amount = ?, category_id = ?, note = ? WHERE id = ?')
      .run(t.date, t.type, t.amount, t.categoryId, t.note, id);
    if (changes === 0) throw new Error(ERRORS.notFound);
  }

  function deleteTransaction(id) {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  }

  // --- Özetler --------------------------------------------------------------

  // Bir ayın gelir, gider ve kategori dağılımı. Toplamları SQL'e yaptırıyoruz
  // (SUM, GROUP BY): binlerce satırı JavaScript'e taşımaktan çok daha hızlı.
  function monthSummary(month) {
    const totals = db
      .prepare(
        `SELECT type, SUM(amount) AS total, COUNT(*) AS count
           FROM transactions WHERE date LIKE ? GROUP BY type`,
      )
      .all(`${month}-%`);
    const income = totals.find((row) => row.type === 'income')?.total ?? 0;
    const expense = totals.find((row) => row.type === 'expense')?.total ?? 0;
    const count = totals.reduce((sum, row) => sum + row.count, 0);

    const byCategory = db
      .prepare(
        `SELECT c.id, c.name, c.color, t.type, SUM(t.amount) AS total
           FROM transactions t JOIN categories c ON c.id = t.category_id
          WHERE t.date LIKE ?
          GROUP BY c.id
          ORDER BY total DESC`,
      )
      .all(`${month}-%`);

    return { month, income, expense, balance: income - expense, count, byCategory };
  }

  // Bir yılın 12 ayı için gelir ve gider toplamları (grafik için). Hiç
  // işlem olmayan aylar da 0 ile listede yer alır.
  function yearTotals(year) {
    const rows = db
      .prepare(
        `SELECT substr(date, 1, 7) AS month, type, SUM(amount) AS total
           FROM transactions WHERE date LIKE ?
          GROUP BY month, type`,
      )
      .all(`${year}-%`);
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      const total = (type) => rows.find((row) => row.month === month && row.type === type)?.total ?? 0;
      return { month, income: total('income'), expense: total('expense') };
    });
  }

  // --- CSV'den toplu ekleme -------------------------------------------------

  // rows: [{ date, type, amount, categoryName, note }]. Bilinmeyen kategori
  // adları yeni kategori olarak eklenir. Hepsi tek bir veritabanı işleminde:
  // bir satır hatalıysa hiçbiri eklenmez.
  function importTransactions(rows) {
    return inTransaction(db, () => {
      const findByName = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
      let createdCategories = 0;
      for (const row of rows) {
        let category = findByName.get(row.categoryName, row.type);
        if (!category) {
          category = { id: addCategory({ name: row.categoryName, type: row.type }) };
          createdCategories++;
        }
        addTransaction({ ...row, categoryId: category.id });
      }
      return { added: rows.length, createdCategories };
    });
  }

  return {
    listCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    listTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    monthSummary,
    yearTotals,
    importTransactions,
  };
}
