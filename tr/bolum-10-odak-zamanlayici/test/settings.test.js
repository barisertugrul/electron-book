// Sıradan test: ayarların doğrulanması.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings.js';

test('boş ya da bozuk girdi varsayılan ayarları verir', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings('bozuk'), DEFAULT_SETTINGS);
});

test('aralık dışı sayılar sınıra çekilir, ondalıklar yuvarlanır', () => {
  const result = normalizeSettings({ focusMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: 14.6 });
  assert.equal(result.focusMinutes, 120);
  assert.equal(result.shortBreakMinutes, 1);
  assert.equal(result.longBreakMinutes, 15);
});

test('sayı olmayan değerler ve yanlış türler varsayılana döner', () => {
  const result = normalizeSettings({ focusMinutes: 'çok', alwaysOnTop: 'evet' });
  assert.equal(result.focusMinutes, DEFAULT_SETTINGS.focusMinutes);
  assert.equal(result.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop);
});

test('tanınmayan alanlar atılır', () => {
  const result = normalizeSettings({ ...DEFAULT_SETTINGS, hacker: true });
  assert.equal('hacker' in result, false);
});
