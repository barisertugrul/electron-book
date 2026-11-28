// budget-store.test.js — Veritabanı servisinin testleri (Bölüm 12.8).
//
// Her testten önce yalnızca bellekte duran (":memory:") yepyeni bir
// veritabanı açıyoruz. Testler birbirinin verisini görmez, diskte iz kalmaz
// ve Electron'u başlatmaya gerek olmaz.

import { beforeEach, describe, expect, it } from 'vitest';

import { createBudgetStore } from '../src/main/budget-store.js';
import { openDatabase } from '../src/main/database.js';
import { ERRORS } from '../src/shared/labels.js';

let store;
let groceries; // "Market" kategorisi (gider)
let salary; // "Maaş" kategorisi (gelir)

beforeEach(() => {
  store = createBudgetStore(openDatabase(':memory:'));
  const categories = store.listCategories();
  groceries = categories.find((category) => category.name === 'Market');
  salary = categories.find((category) => category.name === 'Maaş');
});

// Test verisini kısaltan yardımcı: yalnızca farklı olan alanları yazarız.
function expense(fields) {
  return { date: '2026-11-03', type: 'expense', amount: 25_000, categoryId: groceries.id, note: '', ...fields };
}

describe('işlemler', () => {
  it('eklenen işlem listede kategori adıyla görünür', () => {
    store.addTransaction(expense({ amount: 84_550, note: 'Haftalık alışveriş' }));

    const [transaction] = store.listTransactions();
    expect(transaction).toMatchObject({
      amount: 84_550,
      note: 'Haftalık alışveriş',
      categoryName: 'Market',
    });
  });

  it('ay filtresi yalnızca o ayın işlemlerini getirir', () => {
    store.addTransaction(expense({ date: '2026-10-31' }));
    store.addTransaction(expense({ date: '2026-11-01' }));
    store.addTransaction(expense({ date: '2026-11-30' }));

    const dates = store.listTransactions({ month: '2026-11' }).map((t) => t.date);
    expect(dates).toEqual(['2026-11-30', '2026-11-01']); // Yeniden eskiye
  });

  it('geçersiz veriyi kaydetmez', () => {
    expect(() => store.addTransaction(expense({ amount: 0 }))).toThrow(ERRORS.invalidAmount);
    expect(() => store.addTransaction(expense({ amount: 12.5 }))).toThrow(ERRORS.invalidAmount);
    expect(() => store.addTransaction(expense({ date: '2026-02-30' }))).toThrow(ERRORS.invalidDate);
    // Gider kaydına gelir kategorisi bağlanamaz.
    expect(() => store.addTransaction(expense({ categoryId: salary.id }))).toThrow(ERRORS.invalidCategory);
    expect(store.listTransactions()).toHaveLength(0);
  });

  it('notta aranan metin SQL olarak çalıştırılmaz', () => {
    store.addTransaction(expense({ note: 'Kahve' }));
    // Değer "?" ile ayrıca gönderildiği için bu sadece aranan bir metindir.
    expect(store.listTransactions({ search: "' OR 1=1 --" })).toHaveLength(0);
    expect(store.listTransactions({ search: 'kah' })).toHaveLength(1);
  });
});

describe('aylık özet', () => {
  it('gelir, gider ve kalanı kuruşu kuruşuna hesaplar', () => {
    store.addTransaction({ ...expense({}), type: 'income', categoryId: salary.id, amount: 4_500_000 });
    store.addTransaction(expense({ amount: 10 })); // 0,10 TL
    store.addTransaction(expense({ amount: 20 })); // 0,20 TL

    const summary = store.monthSummary('2026-11');
    expect(summary.income).toBe(4_500_000);
    expect(summary.expense).toBe(30); // 0,1 + 0,2 = tam 0,30 (KT: neden kuruş?)
    expect(summary.balance).toBe(4_499_970);
    expect(summary.count).toBe(3);
  });

  it('yıl toplamında işlemsiz aylar 0 olarak yer alır', () => {
    store.addTransaction(expense({ date: '2026-03-15', amount: 1_000 }));
    const totals = store.yearTotals(2026);
    expect(totals).toHaveLength(12);
    expect(totals[2]).toEqual({ month: '2026-03', income: 0, expense: 1_000 });
    expect(totals[0].expense).toBe(0);
  });
});

describe('kategoriler', () => {
  it('işlemi olan kategori silinemez', () => {
    store.addTransaction(expense({}));
    expect(() => store.deleteCategory(groceries.id)).toThrow(ERRORS.categoryInUse);
  });

  it('aynı türde aynı ad iki kez eklenemez', () => {
    expect(() => store.addCategory({ name: 'Market', type: 'expense' })).toThrow(ERRORS.categoryExists);
  });
});

describe('CSV içe aktarma', () => {
  it('bir satır hatalıysa hiçbir satır eklenmez', () => {
    const rows = [
      { date: '2026-11-01', type: 'expense', amount: 1_000, categoryName: 'Market', note: '' },
      { date: '2026-11-02', type: 'expense', amount: -5, categoryName: 'Market', note: '' },
    ];
    expect(() => store.importTransactions(rows)).toThrow();
    expect(store.listTransactions()).toHaveLength(0);
  });

  it('bilinmeyen kategoriyi oluşturur', () => {
    const result = store.importTransactions([
      { date: '2026-11-01', type: 'expense', amount: 1_000, categoryName: 'Kırtasiye', note: '' },
    ]);
    expect(result).toEqual({ added: 1, createdCategories: 1 });
    expect(store.listCategories().some((category) => category.name === 'Kırtasiye')).toBe(true);
  });
});
