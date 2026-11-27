// common.js — Small helpers shared by the three pages.

export const api = window.focusTimer;

export const PHASE_LABELS = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

// 1500000 ms -> "25:00" (the same function as in timer.js; the renderer
// process cannot import the main process's files, so it lives here too).
export function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Let the Escape key close the window (in the settings and summary windows).
export function closeOnEscape() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') api.closeWindow();
  });
}
