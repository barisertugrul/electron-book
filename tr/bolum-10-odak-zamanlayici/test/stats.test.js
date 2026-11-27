// Sıradan test: günlük istatistikler.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dateKey, lastDays, recordFocusSession } from '../src/stats.js';

test('tarih anahtarı yerel saate göre YYYY-AA-GG olur', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('odak oturumu o günün toplamına eklenir, eski veri değişmez', () => {
  const day = new Date(2026, 10, 27);
  const empty = { days: {} };

  const once = recordFocusSession(empty, 25, day);
  const twice = recordFocusSession(once, 25, day);

  assert.deepEqual(twice.days['2026-11-27'], { sessions: 2, focusMinutes: 50 });
  assert.deepEqual(empty, { days: {} });
});

test('son 7 gün, kaydı olmayan günler sıfır olarak, eskiden yeniye gelir', () => {
  const stats = { days: { '2026-11-25': { sessions: 1, focusMinutes: 25 } } };

  const days = lastDays(stats, 7, new Date(2026, 10, 27));

  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-11-21');
  assert.equal(days[6].date, '2026-11-27');
  assert.deepEqual(days[4], { date: '2026-11-25', sessions: 1, focusMinutes: 25 });
  assert.equal(days[6].focusMinutes, 0);
});

test('ay sınırını doğru geçer', () => {
  const days = lastDays({ days: {} }, 3, new Date(2026, 2, 1));
  assert.deepEqual(days.map((day) => day.date), ['2026-02-27', '2026-02-28', '2026-03-01']);
});
