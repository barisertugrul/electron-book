// Sıradan test: pencere başlığı ve dosya adı yardımcıları.
// Çalıştırmak için: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildWindowTitle, getDisplayName } from '../src/document.js';

test('yeni not "Adsız" olarak görünür', () => {
  assert.equal(getDisplayName(null), 'Adsız');
});

test('dosya adı yolun sonundan alınır (Windows ve Linux/macOS)', () => {
  assert.equal(getDisplayName('C:\\Notlar\\alisveris.md'), 'alisveris.md');
  assert.equal(getDisplayName('/home/ayse/notlar/fikirler.md'), 'fikirler.md');
});

test('kaydedilmiş belgenin başlığında işaret yoktur', () => {
  assert.equal(buildWindowTitle('/notlar/plan.md', false), 'plan.md — Hızlı Not');
});

test('kaydedilmemiş değişiklik başlığa "•" ekler', () => {
  assert.equal(buildWindowTitle(null, true), '• Adsız — Hızlı Not');
});
