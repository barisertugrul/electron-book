// Teaching test: we control the time.
//
// We can't wait 25 minutes to test a real 25-minute session. We gave
// FocusTimer a function that answers "what time is it?" (now). In the test
// this function reads a fake clock that we move forward by hand.
// To run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FocusTimer, formatTime } from '../src/timer.js';

const MINUTE = 60 * 1000;

// Simple settings: so the arithmetic stays easy.
const settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 2,
  autoStartNext: false,
};

// Fake clock: clock.now() gives the current time, clock.advance() moves it forward.
function createClock() {
  let time = 0;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}

test('10 minutes after starting, 15 minutes are left', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  timer.start();
  clock.advance(10 * MINUTE);

  assert.equal(timer.getRemainingMs(), 15 * MINUTE);
});

test('time stops while paused and continues from where it stopped', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  timer.start();
  clock.advance(5 * MINUTE);
  timer.pause();
  clock.advance(60 * MINUTE); // The user took an hour off
  assert.equal(timer.getRemainingMs(), 20 * MINUTE);

  timer.start();
  clock.advance(1 * MINUTE);
  assert.equal(timer.getRemainingMs(), 19 * MINUTE);
});

test('a short break follows focus and the "phase-end" event fires', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });
  const events = [];
  timer.on('phase-end', (event) => events.push(event));

  timer.start();
  clock.advance(25 * MINUTE);
  timer.tick(); // We do by hand what setInterval does in the main process

  assert.deepEqual(events, [{ finished: 'focus', next: 'shortBreak' }]);
  assert.equal(timer.phase, 'shortBreak');
  assert.equal(timer.running, false); // autoStartNext is off: the break waits
  assert.equal(timer.getRemainingMs(), 5 * MINUTE);
});

test('a long break comes after the set number of focus sessions, then the round resets', () => {
  const clock = createClock();
  const timer = new FocusTimer(settings, { now: clock.now });

  // A helper that starts a phase and runs it to the end.
  const finishPhase = () => {
    timer.start();
    clock.advance(timer.getRemainingMs());
    timer.tick();
    return timer.phase;
  };

  assert.equal(finishPhase(), 'shortBreak'); // 1st focus done
  assert.equal(finishPhase(), 'focus');
  assert.equal(finishPhase(), 'longBreak'); // 2nd focus done: long break
  assert.equal(timer.completedFocus, 2);
  assert.equal(finishPhase(), 'focus');
  assert.equal(timer.completedFocus, 0); // A new round
});

test('a skipped focus session does not count toward the round', () => {
  const timer = new FocusTimer(settings, { now: createClock().now });

  timer.skip();

  assert.equal(timer.phase, 'shortBreak');
  assert.equal(timer.completedFocus, 0);
});

test('time is written as mm:ss and remaining seconds round up', () => {
  assert.equal(formatTime(25 * MINUTE), '25:00');
  assert.equal(formatTime(61 * 1000), '01:01');
  assert.equal(formatTime(500), '00:01'); // Half a second left is not 00:00
  assert.equal(formatTime(0), '00:00');
});
