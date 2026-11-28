// database.js — Veritabanını açar ve tabloları güncel sürüme taşır.
//
// SQLite, tek bir dosyada duran küçük ama gerçek bir SQL veritabanıdır.
// Electron 45'in içindeki Node.js 24, SQLite'ı "node:sqlite" modülüyle hazır
// getirir: ek paket kurmaya ya da derlemeye gerek yok.

import { DatabaseSync } from 'node:sqlite';

import { DEFAULT_CATEGORIES } from '../shared/labels.js';

// Veri taşımaları (migration). Her eleman veritabanını bir sürüm ileri taşır.
// Kural: yayımlanmış bir taşımayı asla değiştirmeyin; yeni bir değişiklik
// için listenin SONUNA yeni bir eleman ekleyin.
export const MIGRATIONS = [
  // Sürüm 1: ilk tablolar ve varsayılan kategoriler.
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

  // Sürüm 2: kategorilere renk. Uygulamanın ilk sürümünü kullananların
  // verisi kaybolmasın diye tabloyu silip yeniden kurmuyoruz; yalnızca
  // yeni bir sütun ekliyoruz.
  (db) => {
    db.exec("ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#8a8f98'");
    const update = db.prepare('UPDATE categories SET color = ? WHERE name = ? AND type = ?');
    for (const category of DEFAULT_CATEGORIES) update.run(category.color, category.name, category.type);
  },
];

// fn'i bir veritabanı işlemi (transaction) içinde çalıştırır: ya hepsi
// kaydedilir ya da hata çıkarsa hiçbiri.
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

// Veritabanının hangi sürümde olduğunu SQLite'ın kendi "user_version"
// alanında tutuyoruz. Eksik taşımaları sırayla çalıştırırız.
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

// file: veritabanı dosyasının yolu. Testlerde ":memory:" verip yalnızca
// bellekte duran, test bitince kaybolan bir veritabanı kullanırız.
export function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON'); // Silinmiş kategoriye işlem bağlanamasın
  migrate(db);
  return db;
}
