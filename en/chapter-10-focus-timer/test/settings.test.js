// Ordinary test: validating the settings.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings.js';

test('empty or broken input gives the default settings', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings('broken'), DEFAULT_SETTINGS);
});

test('out-of-range numbers are clamped, decimals are rounded', () => {
  const result = normalizeSettings({ focusMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: 14.6 });
  assert.equal(result.focusMinutes, 120);
  assert.equal(result.shortBreakMinutes, 1);
  assert.equal(result.longBreakMinutes, 15);
});

test('non-numbers and wrong types fall back to the default', () => {
  const result = normalizeSettings({ focusMinutes: 'lots', alwaysOnTop: 'yes' });
  assert.equal(result.focusMinutes, DEFAULT_SETTINGS.focusMinutes);
  assert.equal(result.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop);
});

test('unknown fields are dropped', () => {
  const result = normalizeSettings({ ...DEFAULT_SETTINGS, hacker: true });
  assert.equal('hacker' in result, false);
});
