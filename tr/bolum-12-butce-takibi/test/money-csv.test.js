// money-csv.test.js — Tutar okuma ve CSV dönüşümü testleri.

import { describe, expect, it } from 'vitest';

import { csvToTransactions, parseCsv, toCsv } from '../src/shared/csv.js';
import { formatAmount, isValidDate, parseAmount, shiftMonth } from '../src/shared/money.js';

describe('parseAmount', () => {
  it('Türkçe yazılan tutarları kuruşa çevirir', () => {
    expect(parseAmount('1.250,50')).toBe(125_050);
    expect(parseAmount('1250,5')).toBe(125_050);
    expect(parseAmount('₺ 45')).toBe(4_500);
    expect(parseAmount('0,1')).toBe(10);
  });

  it('geçersiz tutarlar için null döner', () => {
    for (const text of ['', 'abc', '0', '-5', '12,345', '1,2,3']) expect(parseAmount(text)).toBeNull();
  });

  it('formatAmount ile geri çevrilebilir', () => {
    expect(formatAmount(125_050)).toBe('1250,50');
    expect(parseAmount(formatAmount(99))).toBe(99);
  });
});

describe('tarih yardımcıları', () => {
  it('ayı yıl sınırında kaydırır', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('takvimde olmayan günleri reddeder', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('28.11.2026')).toBe(false);
  });
});

describe('CSV', () => {
  const transaction = { date: '2026-11-03', type: 'expense', amount: 84_550, categoryName: 'Market', note: 'Süt; ekmek "taze"' };

  it('ayırıcı ve tırnak içeren notları bozmadan yazar ve okur', () => {
    const csv = toCsv([transaction]);
    expect(csv.startsWith('\uFEFFTarih;Tür;Kategori;Tutar;Not\r\n')).toBe(true);
    expect(parseCsv(csv)[1]).toEqual(['2026-11-03', 'Gider', 'Market', '845,50', 'Süt; ekmek "taze"']);
  });

  it('dışa aktarılan dosya aynen içe aktarılabilir', () => {
    const { rows, errors } = csvToTransactions(toCsv([transaction]));
    expect(errors).toEqual([]);
    expect(rows).toEqual([transaction]);
  });

  it('virgülle ayrılmış ve gün.ay.yıl tarihli dosyayı da okur', () => {
    const { rows } = csvToTransactions('Tür,Tarih,Tutar,Kategori\ngelir,05.11.2026,"45.000,00",Maaş\n');
    expect(rows[0]).toMatchObject({ date: '2026-11-05', type: 'income', amount: 4_500_000, categoryName: 'Maaş' });
  });

  it('hatalı satırları numarasıyla bildirir', () => {
    const { rows, errors } = csvToTransactions('Tarih;Tür;Kategori;Tutar\n2026-11-01;Gider;Market;abc\n');
    expect(rows).toEqual([]);
    expect(errors).toEqual(['2. satır: Tutar sıfırdan büyük bir sayı olmalı (en çok iki ondalık).']);
  });
});
