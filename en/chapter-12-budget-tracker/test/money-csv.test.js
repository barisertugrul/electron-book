// money-csv.test.js — Tests for reading amounts and converting CSV.

import { describe, expect, it } from 'vitest';

import { csvToTransactions, parseCsv, toCsv } from '../src/shared/csv.js';
import { formatAmount, isValidDate, parseAmount, shiftMonth } from '../src/shared/money.js';

describe('parseAmount', () => {
  it('converts amounts written in English to cents', () => {
    expect(parseAmount('1,250.50')).toBe(125_050);
    expect(parseAmount('1250.5')).toBe(125_050);
    expect(parseAmount('$ 45')).toBe(4_500);
    expect(parseAmount('0.1')).toBe(10);
  });

  it('returns null for invalid amounts', () => {
    for (const text of ['', 'abc', '0', '-5', '12.345', '1.2.3']) expect(parseAmount(text)).toBeNull();
  });

  it('can be reversed with formatAmount', () => {
    expect(formatAmount(125_050)).toBe('1250.50');
    expect(parseAmount(formatAmount(99))).toBe(99);
  });
});

describe('date helpers', () => {
  it('moves the month across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rejects days that are not in the calendar', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('28.11.2026')).toBe(false);
  });
});

describe('CSV', () => {
  const transaction = { date: '2026-11-03', type: 'expense', amount: 84_550, categoryName: 'Groceries', note: 'Milk, bread "fresh"' };

  it('writes and reads notes with separators and quotes without breaking them', () => {
    const csv = toCsv([transaction]);
    expect(csv.startsWith('\uFEFFDate,Type,Category,Amount,Note\r\n')).toBe(true);
    expect(parseCsv(csv)[1]).toEqual(['2026-11-03', 'Expense', 'Groceries', '845.50', 'Milk, bread "fresh"']);
  });

  it('an exported file can be imported as it is', () => {
    const { rows, errors } = csvToTransactions(toCsv([transaction]));
    expect(errors).toEqual([]);
    expect(rows).toEqual([transaction]);
  });

  it('also reads semicolon-separated files and day.month.year dates', () => {
    const { rows } = csvToTransactions('Type;Date;Amount;Category\nincome;05.11.2026;"45,000.00";Salary\n');
    expect(rows[0]).toMatchObject({ date: '2026-11-05', type: 'income', amount: 4_500_000, categoryName: 'Salary' });
  });

  it('reports invalid rows with their line numbers', () => {
    const { rows, errors } = csvToTransactions('Date,Type,Category,Amount\n2026-11-01,Expense,Groceries,abc\n');
    expect(rows).toEqual([]);
    expect(errors).toEqual(['Line 2: The amount must be a number greater than zero (at most two decimals).']);
  });
});
