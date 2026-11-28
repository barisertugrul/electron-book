// database.js — Opens the database and migrates the tables to the current version.
//
// SQLite is a small but real SQL database that lives in a single file.
// Node.js 24 inside Electron 45 ships SQLite ready to use through the
// "node:sqlite" module: no extra package to install or compile.

import { DatabaseSync } from 'node:sqlite';

import { DEFAULT_CATEGORIES } from '../shared/labels.js';

// Migrations. Each element moves the database forward by one version.
// Rule: never change a migration that has been released; for a new change,
// add a new element to the END of the list.
export const MIGRATIONS = [
  // Version 1: the first tables and the default categories.
  (db) => {
    db.exec(`
      CREATE TABLE categories (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        UNIQUE (name, type)
      );

      CREATE TABLE transactions (
        id          INTEGER PRIMARY KEY,
        date        TEXT NOT NULL,
        type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount      INTEGER NOT NULL CHECK (amount > 0),
        category_id INTEGER NOT NULL REFERENCES categories (id),
        note        TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX transactions_date ON transactions (date);
    `);
    const insert = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
    for (const category of DEFAULT_CATEGORIES) insert.run(category.name, category.type);
  },

  // Version 2: colors for categories. So that people using the first version
  // of the app don't lose their data, we don't drop and recreate the table;
  // we only add a new column.
  (db) => {
    db.exec("ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#8a8f98'");
    const update = db.prepare('UPDATE categories SET color = ? WHERE name = ? AND type = ?');
    for (const category of DEFAULT_CATEGORIES) update.run(category.color, category.name, category.type);
  },
];

// Runs fn inside a database transaction: either everything is saved or,
// if an error occurs, nothing is.
export function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// We keep the database's version in SQLite's own "user_version" field.
// Missing migrations are run in order.
export function migrate(db, migrations = MIGRATIONS) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let version = current + 1; version <= migrations.length; version++) {
    inTransaction(db, () => {
      migrations[version - 1](db);
      db.exec(`PRAGMA user_version = ${version}`);
    });
  }
  return migrations.length;
}

// file: the path of the database file. In tests we pass ":memory:" to use a
// database that lives only in memory and disappears when the test ends.
export function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON'); // A transaction cannot point to a deleted category
  migrate(db);
  return db;
}
