// timer-window.js — The mini timer window.
//
// This page doesn't count anything. The timer runs in the main process; the
// page only draws the state it receives and sends commands when buttons are
// pressed. The timer keeps running correctly while the window is hidden.

import { api, formatTime, PHASE_LABELS } from './common.js';

const elements = {
  phaseLabel: document.querySelector('#phase-label'),
  time: document.querySelector('#time'),
  ring: document.querySelector('#ring-progress'),
  dots: document.querySelector('#dots'),
  toggle: document.querySelector('#btn-toggle'),
};

// The ring's circumference: 2πr (r = 58). We control how much of the stroke
// is visible with stroke-dashoffset.
const RING_LENGTH = 2 * Math.PI * 58;
elements.ring.style.strokeDasharray = String(RING_LENGTH);

function render(state) {
  document.body.dataset.phase = state.phase; // CSS changes the color by phase
  elements.phaseLabel.textContent = PHASE_LABELS[state.phase];
  elements.time.textContent = formatTime(state.remainingMs);
  elements.toggle.textContent = state.running ? 'Pause' : 'Start';

  const remaining = state.remainingMs / state.durationMs; // 1 → 0
  elements.ring.style.strokeDashoffset = String(RING_LENGTH * (1 - remaining));

  // Round indicator: ●●○○ (finished / total focus sessions)
  elements.dots.replaceChildren(
    ...Array.from({ length: state.sessionsBeforeLongBreak }, (_, index) => {
      const dot = document.createElement('span');
      dot.className = index < state.completedFocus ? 'dot done' : 'dot';
      return dot;
    }),
  );
}

elements.toggle.addEventListener('click', () => api.toggle());
document.querySelector('#btn-reset').addEventListener('click', () => api.reset());
document.querySelector('#btn-skip').addEventListener('click', () => api.skip());
document.querySelector('#btn-settings').addEventListener('click', () => api.openWindow('settings'));
document.querySelector('#btn-summary').addEventListener('click', () => api.openWindow('summary'));
document.querySelector('#btn-hide').addEventListener('click', () => api.closeWindow());

// The space bar starts/pauses while the window has focus.
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && event.target === document.body) {
    event.preventDefault();
    api.toggle();
  }
});

api.onState(render);
render(await api.getState());
