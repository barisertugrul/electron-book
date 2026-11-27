// timer.js — The heart of the Pomodoro timer.
//
// There is no Electron in this file; it is plain JavaScript. That is why we
// can test the timer with `npm test` without opening the app.
//
// The cycle: focus → short break → focus → short break → ... → long break.
// How many focus sessions come before a long break is a setting.

import { EventEmitter } from 'node:events';

// The phase names used in code. The names shown on screen live in the UI files.
export const PHASES = ['focus', 'shortBreak', 'longBreak'];

const MINUTE = 60 * 1000;

export class FocusTimer extends EventEmitter {
  // now: a function that answers "what time is it, in milliseconds?"
  // The app uses Date.now; in tests we move the clock forward ourselves.
  constructor(settings, { now = Date.now } = {}) {
    super();
    this.now = now;
    this.settings = settings;
    this.phase = 'focus';
    this.completedFocus = 0; // Focus sessions finished in this round
    this.running = false;
    this.endsAt = null; // While running: the moment the phase ends (ms)
    this.remainingMs = this.phaseDuration('focus');
  }

  // A phase's length from the settings (milliseconds).
  phaseDuration(phase) {
    const minutes = {
      focus: this.settings.focusMinutes,
      shortBreak: this.settings.shortBreakMinutes,
      longBreak: this.settings.longBreakMinutes,
    }[phase];
    return minutes * MINUTE;
  }

  // The current state we send to the UI and the tray. It is a plain object,
  // so it travels over IPC without any trouble.
  getState() {
    return {
      phase: this.phase,
      running: this.running,
      remainingMs: this.getRemainingMs(),
      durationMs: this.phaseDuration(this.phase),
      completedFocus: this.completedFocus,
      sessionsBeforeLongBreak: this.settings.sessionsBeforeLongBreak,
    };
  }

  // We don't COUNT the remaining time, we CALCULATE it: end time minus now.
  // setInterval may not fire on time (the computer may sleep, the CPU may be
  // busy); with this approach the time stays correct anyway.
  getRemainingMs() {
    if (!this.running) return this.remainingMs;
    return Math.max(0, this.endsAt - this.now());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.endsAt = this.now() + this.remainingMs;
    this.emitChange();
  }

  pause() {
    if (!this.running) return;
    this.remainingMs = this.getRemainingMs();
    this.running = false;
    this.endsAt = null;
    this.emitChange();
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  // Restarts the current phase from the beginning (paused).
  reset() {
    this.running = false;
    this.endsAt = null;
    this.remainingMs = this.phaseDuration(this.phase);
    this.emitChange();
  }

  // Moves to the next phase without finishing this one. A skipped focus
  // session does not count.
  skip() {
    this.moveToNextPhase({ countFocus: false });
  }

  // Called when the settings change. A phase that is not running takes the new length.
  updateSettings(settings) {
    this.settings = settings;
    if (!this.running) this.remainingMs = this.phaseDuration(this.phase);
    this.emitChange();
  }

  // The main process calls this a few times per second.
  tick() {
    if (!this.running) return;
    if (this.getRemainingMs() > 0) {
      this.emit('tick', this.getState());
      return;
    }
    // Time is up.
    const finished = this.phase;
    this.moveToNextPhase({ countFocus: true });
    this.emit('phase-end', { finished, next: this.phase });
  }

  // Decides the next phase. The new phase starts paused; if "auto start"
  // is on in the settings, it runs right away.
  moveToNextPhase({ countFocus }) {
    const wasFocus = this.phase === 'focus';
    if (wasFocus && countFocus) this.completedFocus += 1;

    if (wasFocus) {
      const timeForLongBreak = countFocus &&
        this.completedFocus >= this.settings.sessionsBeforeLongBreak;
      this.phase = timeForLongBreak ? 'longBreak' : 'shortBreak';
    } else {
      // A new round starts after the long break.
      if (this.phase === 'longBreak') this.completedFocus = 0;
      this.phase = 'focus';
    }

    this.running = false;
    this.endsAt = null;
    this.remainingMs = this.phaseDuration(this.phase);
    if (this.settings.autoStartNext) this.start();
    else this.emitChange();
  }

  emitChange() {
    this.emit('change', this.getState());
  }
}

// 1500000 ms -> "25:00"
export function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
