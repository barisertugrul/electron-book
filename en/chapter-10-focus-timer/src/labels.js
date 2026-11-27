// labels.js — Text the main process puts on screen (tray menu, notifications).
// Keeping it all in one place makes translating the app easier.

export const APP_NAME = 'Focus Timer';

export const PHASE_LABELS = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

export const TRAY_TEXT = {
  running: 'running',
  paused: 'paused',
  start: 'Start',
  pause: 'Pause',
  reset: 'Reset',
  skip: 'Skip to next phase',
  showTimer: 'Show timer',
  summary: 'Daily summary',
  settings: 'Settings…',
  quit: 'Quit',
};

export const WINDOW_TITLES = {
  settings: 'Settings',
  summary: 'Daily summary',
};

// The title and text of the notification shown when a phase ends.
export function phaseEndMessage(finished, next, minutes, autoStarted) {
  const tail = autoStarted ? '' : ' Click to start.';
  if (finished === 'focus' && next === 'longBreak') {
    return { title: 'Great, you finished a round!', body: `Time for a long break: ${minutes} minutes.${tail}` };
  }
  if (finished === 'focus') {
    return { title: 'Focus session finished', body: `Take a short break: ${minutes} minutes.${tail}` };
  }
  return { title: 'Break is over', body: `New focus session: ${minutes} minutes.${tail}` };
}
