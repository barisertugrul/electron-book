// migrations.test.js — Tests for the migrations.
//
// Someone using version 1 of the app must not lose their data when moving to
// version 2. We try this by first building the database with only the first
// migration and then updating it.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrate } from '../src/main/database.js';

describe('migrate', () => {
  it('brings a new database to the latest version', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATIONS.length);
  });

  it('keeps transactions from an old version after updating', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 1)); // Version 1 on the user's computer
    const { id } = db.prepare("SELECT id FROM categories WHERE name = 'Rent'").get();
    db.prepare("INSERT INTO transactions (date, type, amount, category_id) VALUES ('2026-01-05', 'expense', 1500000, ?)").run(id);

    migrate(db); // The app was updated

    const row = db
      .prepare('SELECT t.amount, c.color FROM transactions t JOIN categories c ON c.id = t.category_id')
      .get();
    expect(row.amount).toBe(1_500_000);
    expect(row.color).toMatch(/^#[0-9a-f]{6}$/); // The new column is filled
  });

  it('does not run migrations twice', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow(); // ALTER TABLE would fail if it ran again
  });
});
