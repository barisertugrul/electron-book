// Ordinary test: window title and file name helpers.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildWindowTitle, getDisplayName } from '../src/document.js';

test('a new note is shown as "Untitled"', () => {
  assert.equal(getDisplayName(null), 'Untitled');
});

test('the file name is taken from the end of the path (Windows and Linux/macOS)', () => {
  assert.equal(getDisplayName('C:\\Notes\\shopping.md'), 'shopping.md');
  assert.equal(getDisplayName('/home/alice/notes/ideas.md'), 'ideas.md');
});

test('a saved document has no mark in its title', () => {
  assert.equal(buildWindowTitle('/notes/plan.md', false), 'plan.md — Quick Note');
});

test('unsaved changes add "•" to the title', () => {
  assert.equal(buildWindowTitle(null, true), '• Untitled — Quick Note');
});
