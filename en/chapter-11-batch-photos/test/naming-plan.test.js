// naming-plan.test.js — Tests for the name template and the output plan.
//
// These tests are explained in the book: before renaming thousands of photos
// we want to be sure the rules produce the right names. plan.js is made of
// pure functions, so we can test it without starting Electron at all.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildName, groupFolder, normalizeRules, planOutputs, sanitizeFileName } from '../src/shared/plan.js';

// Creates a test photo. We pass the month as on a calendar (11 = November);
// Date counts months from 0, so we subtract 1. We build the date in local
// time, because the app also shows dates in local time.
function photo(name, year, month, day, hour = 12, minute = 0, second = 0) {
  return {
    path: `/photos/${name}`,
    name,
    size: 1000,
    takenAt: new Date(year, month - 1, day, hour, minute, second).toISOString(),
  };
}

describe('buildName', () => {
  test('fills the template words with the photo date', () => {
    const name = buildName('{year}-{month}-{day}_{hour}{minute}{second}', photo('IMG_1.JPG', 2026, 11, 7, 9, 5, 3), 1);
    assert.equal(name, '2026-11-07_090503');
  });

  test('{counter} has three digits, {name} is the original name without extension', () => {
    assert.equal(buildName('{counter} {name}', photo('IMG_2041.JPG', 2026, 1, 1), 7), '007 IMG_2041');
  });

  test('"/" and ".." in the template cannot change the folder', () => {
    const name = buildName('../../{name}', photo('a.jpg', 2026, 1, 1), 1);
    assert.equal(name, '..-..-a');
    assert.ok(!name.includes('/'));
  });

  test('the original name is used if the template gives an empty name', () => {
    assert.equal(buildName('  ', photo('Holiday.jpg', 2026, 1, 1), 1), 'Holiday');
  });
});

describe('sanitizeFileName', () => {
  test('removes characters Windows forbids and a trailing dot', () => {
    assert.equal(sanitizeFileName('a:b*c?.'), 'a-b-c-');
    assert.equal(sanitizeFileName('Holiday. '), 'Holiday');
  });

  test('changes device names (CON, NUL...)', () => {
    assert.equal(sanitizeFileName('con'), 'con_');
  });
});

describe('groupFolder', () => {
  const sample = photo('a.jpg', 2026, 3, 9);
  test('folder by year and by month', () => {
    assert.equal(groupFolder(sample, 'none'), '');
    assert.equal(groupFolder(sample, 'year'), '2026');
    assert.equal(groupFolder(sample, 'month'), '2026/2026-03');
  });
});

describe('planOutputs', () => {
  const rules = normalizeRules({ template: '{year}{month}{day}', grouping: 'month' });

  test('sorts photos by date, {counter} follows that order', () => {
    const plan = planOutputs(
      [photo('new.jpg', 2026, 11, 2), photo('old.jpg', 2026, 10, 30)],
      normalizeRules({ template: '{counter}', grouping: 'none' }),
    );
    assert.deepEqual(
      plan.map((item) => item.target),
      ['001.jpg', '002.jpg'],
    );
    assert.equal(plan[0].photo.name, 'old.jpg');
  });

  test('photos that get the same name are told apart with -2, -3', () => {
    const plan = planOutputs(
      [photo('a.jpg', 2026, 11, 1, 10), photo('b.jpg', 2026, 11, 1, 11), photo('c.JPEG', 2026, 11, 1, 12)],
      rules,
    );
    assert.deepEqual(
      plan.map((item) => item.target),
      ['2026/2026-11/20261101.jpg', '2026/2026-11/20261101-2.jpg', '2026/2026-11/20261101-3.jpg'],
    );
  });

  test('letter case alone does not make a different file (Windows)', () => {
    const plan = planOutputs(
      [photo('A.jpg', 2026, 1, 1, 10), photo('a.jpg', 2026, 1, 1, 11)],
      normalizeRules({ template: '{name}', grouping: 'none' }),
    );
    assert.deepEqual(plan.map((item) => item.target), ['A.jpg', 'a-2.jpg']);
  });

  test('the same name in different folders is not a clash', () => {
    const plan = planOutputs([photo('a.jpg', 2025, 12, 31), photo('b.jpg', 2026, 1, 1)], {
      ...rules,
      template: 'cover',
      grouping: 'year',
    });
    assert.deepEqual(plan.map((item) => item.target), ['2025/cover.jpg', '2026/cover.jpg']);
  });
});

describe('normalizeRules', () => {
  test('drops unknown fields and resets invalid values to defaults', () => {
    const rules = normalizeRules({ grouping: 'all', maxSize: 1234, quality: 500, extra: true });
    assert.equal(rules.grouping, 'month');
    assert.equal(rules.maxSize, 1920);
    assert.equal(rules.quality, 100);
    assert.equal('extra' in rules, false);
  });
});
