// Öğretici test: zamanı biz kontrol ediyoruz.
//
// Gerçek bir 25 dakikalık oturumu test etmek için 25 dakika bekleyemeyiz.
// FocusTimer'a "şu an saat kaç?" sorusunu cevaplayan bir fonksiyon verdik
// (now). Testte bu fonksiyon, bizim elle ilerlettiğimiz sahte bir saate bakar.
// Çalıştırmak için: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FocusTimer, formatTime } from '../src/timer.js';

const MINUTE = 60 * 1000;

// Kısa süreli ayarlar: hesaplar kolay olsun.
const settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 2,
  autoStartNext: false,
};

// Sahte saat: clock.now() şu anki zamanı verir, clock.advance() ileri sarar.
function createClock() {
  let time = 0;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}

test('başladıktan 10 dakika sonra 15 dakika kalır', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  timer.start();
  clock.advance(10 * MINUTE);

  assert.equal(timer.getRemainingMs(), 15 * MINUTE);
});

test('duraklatınca süre akmaz, devam edince kaldığı yerden sürer', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  timer.start();
  clock.advance(5 * MINUTE);
  timer.pause();
  clock.advance(60 * MINUTE); // Kullanıcı bir saat ara verdi
  assert.equal(timer.getRemainingMs(), 20 * MINUTE);

  timer.start();
  clock.advance(1 * MINUTE);
  assert.equal(timer.getRemainingMs(), 19 * MINUTE);
});

test('odak bitince kısa mola gelir ve "phase-end" olayı tetiklenir', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });
  const events = [];
  timer.on('phase-end', (event) => events.push(event));

  timer.start();
  clock.advance(25 * MINUTE);
  timer.tick(); // Ana süreçteki setInterval'ın yaptığını elle yapıyoruz

  assert.deepEqual(events, [{ finished: 'focus', next: 'shortBreak' }]);
  assert.equal(timer.phase, 'shortBreak');
  assert.equal(timer.running, false); // autoStartNext kapalı: mola beklemede
  assert.equal(timer.getRemainingMs(), 5 * MINUTE);
});

test('ayarlanan sayıda odaktan sonra uzun mola gelir, sonra tur sıfırlanır', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  // Bir aşamayı başlatıp sonuna kadar götüren yardımcı.
  const finishPhase = () => {
    timer.start();
    clock.advance(timer.getRemainingMs());
    timer.tick();
    return timer.phase;
  };

  assert.equal(finishPhase(), 'shortBreak'); // 1. odak bitti
  assert.equal(finishPhase(), 'focus');
  assert.equal(finishPhase(), 'longBreak'); // 2. odak bitti: uzun mola
  assert.equal(timer.completedFocus, 2);
  assert.equal(finishPhase(), 'focus');
  assert.equal(timer.completedFocus, 0); // Yeni tur
});

test('atlanan odak oturumu tura sayılmaz', () => {
  const timer = new FocusTimer(settings, { now: createClock().now });

  timer.skip();

  assert.equal(timer.phase, 'shortBreak');
  assert.equal(timer.completedFocus, 0);
});

test('süre mm:ss biçiminde yazılır, kalan saniye yukarı yuvarlanır', () => {
  assert.equal(formatTime(25 * MINUTE), '25:00');
  assert.equal(formatTime(61 * 1000), '01:01');
  assert.equal(formatTime(500), '00:01'); // Yarım saniye kaldıysa 00:00 değil
  assert.equal(formatTime(0), '00:00');
});
