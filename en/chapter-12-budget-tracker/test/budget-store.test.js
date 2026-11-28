// budget-store.test.js — Tests for the database service (Section 12.8).
//
// Before each test we open a brand new database that lives only in memory
// (":memory:"). Tests don't see each other's data, nothing is left on disk,
// and there is no need to start Electron.

import { beforeEach, describe, expect, it } from 'vitest';

import { createBudgetStore } from '../src/main/budget-store.js';
import { openDatabase } from '../src/main/database.js';
import { ERRORS } from '../src/shared/labels.js';

let store;
let groceries; // The "Groceries" category (expense)
let salary; // The "Salary" category (income)

beforeEach(() => {
  store = createBudgetStore(openDatabase(':memory:'));
  const categories = store.listCategories();
  groceries = categories.find((category) => category.name === 'Groceries');
  salary = categories.find((category) => category.name === 'Salary');
});

// A helper that shortens test data: we only write the fields that differ.
function expense(fields) {
  return { date: '2026-11-03', type: 'expense', amount: 25_000, categoryId: groceries.id, note: '', ...fields };
}

describe('transactions', () => {
  it('shows an added transaction in the list with its category name', () => {
    store.addTransaction(expense({ amount: 84_550, note: 'Weekly shopping' }));

    const [transaction] = store.listTransactions();
    expect(transaction).toMatchObject({
      amount: 84_550,
      note: 'Weekly shopping',
      categoryName: 'Groceries',
    });
  });

  it('the month filter returns only that month', () => {
    store.addTransaction(expense({ date: '2026-10-31' }));
    store.addTransaction(expense({ date: '2026-11-01' }));
    store.addTransaction(expense({ date: '2026-11-30' }));

    const dates = store.listTransactions({ month: '2026-11' }).map((t) => t.date);
    expect(dates).toEqual(['2026-11-30', '2026-11-01']); // Newest first
  });

  it('does not save invalid data', () => {
    expect(() => store.addTransaction(expense({ amount: 0 }))).toThrow(ERRORS.invalidAmount);
    expect(() => store.addTransaction(expense({ amount: 12.5 }))).toThrow(ERRORS.invalidAmount);
    expect(() => store.addTransaction(expense({ date: '2026-02-30' }))).toThrow(ERRORS.invalidDate);
    // An expense cannot use an income category.
    expect(() => store.addTransaction(expense({ categoryId: salary.id }))).toThrow(ERRORS.invalidCategory);
    expect(store.listTransactions()).toHaveLength(0);
  });

  it('search text is never run as SQL', () => {
    store.addTransaction(expense({ note: 'Coffee' }));
    // The value is sent separately for "?", so this is just text to search for.
    expect(store.listTransactions({ search: "' OR 1=1 --" })).toHaveLength(0);
    expect(store.listTransactions({ search: 'cof' })).toHaveLength(1);
  });
});

describe('monthly summary', () => {
  it('calculates income, expenses and balance to the cent', () => {
    store.addTransaction({ ...expense({}), type: 'income', categoryId: salary.id, amount: 4_500_000 });
    store.addTransaction(expense({ amount: 10 })); // $0.10
    store.addTransaction(expense({ amount: 20 })); // $0.20

    const summary = store.monthSummary('2026-11');
    expect(summary.income).toBe(4_500_000);
    expect(summary.expense).toBe(30); // 0.1 + 0.2 = exactly 0.30 (why cents? see the JS box)
    expect(summary.balance).toBe(4_499_970);
    expect(summary.count).toBe(3);
  });

  it('months without transactions appear in the yearly totals as 0', () => {
    store.addTransaction(expense({ date: '2026-03-15', amount: 1_000 }));
    const totals = store.yearTotals(2026);
    expect(totals).toHaveLength(12);
    expect(totals[2]).toEqual({ month: '2026-03', income: 0, expense: 1_000 });
    expect(totals[0].expense).toBe(0);
  });
});

describe('categories', () => {
  it('a category with transactions cannot be deleted', () => {
    store.addTransaction(expense({}));
    expect(() => store.deleteCategory(groceries.id)).toThrow(ERRORS.categoryInUse);
  });

  it('the same name cannot be added twice for the same type', () => {
    expect(() => store.addCategory({ name: 'Groceries', type: 'expense' })).toThrow(ERRORS.categoryExists);
  });
});

describe('CSV import', () => {
  it('adds no rows if one row is invalid', () => {
    const rows = [
      { date: '2026-11-01', type: 'expense', amount: 1_000, categoryName: 'Groceries', note: '' },
      { date: '2026-11-02', type: 'expense', amount: -5, categoryName: 'Groceries', note: '' },
    ];
    expect(() => store.importTransactions(rows)).toThrow();
    expect(store.listTransactions()).toHaveLength(0);
  });

  it('creates unknown categories', () => {
    const result = store.importTransactions([
      { date: '2026-11-01', type: 'expense', amount: 1_000, categoryName: 'Stationery', note: '' },
    ]);
    expect(result).toEqual({ added: 1, createdCategories: 1 });
    expect(store.listCategories().some((category) => category.name === 'Stationery')).toBe(true);
  });
});
