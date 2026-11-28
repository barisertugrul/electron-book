// migrations.test.js — Veri taşımalarının (migration) testi.
//
// Uygulamanın 1. sürümünü kullanan birinin verisi, 2. sürüme geçince
// kaybolmamalı. Bunu, veritabanını önce yalnızca ilk taşımayla kurup sonra
// güncelleyerek deniyoruz.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrate } from '../src/main/database.js';

describe('migrate', () => {
  it('yeni veritabanını son sürüme getirir', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATIONS.length);
  });

  it('eski sürümdeki işlemler yeni sürüme geçince korunur', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 1)); // Kullanıcının bilgisayarındaki 1. sürüm
    const { id } = db.prepare("SELECT id FROM categories WHERE name = 'Kira'").get();
    db.prepare("INSERT INTO transactions (date, type, amount, category_id) VALUES ('2026-01-05', 'expense', 1500000, ?)").run(id);

    migrate(db); // Uygulama güncellendi

    const row = db
      .prepare('SELECT t.amount, c.color FROM transactions t JOIN categories c ON c.id = t.category_id')
      .get();
    expect(row.amount).toBe(1_500_000);
    expect(row.color).toMatch(/^#[0-9a-f]{6}$/); // Yeni sütun dolu
  });

  it('taşımalar ikinci kez çalıştırılmaz', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow(); // ALTER TABLE tekrar denenseydi hata verirdi
  });
});
