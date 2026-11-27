// timer-window.js — Mini zamanlayıcı penceresi.
//
// Bu sayfa hiçbir şey saymaz. Zamanlayıcı ana süreçte çalışır; sayfa yalnızca
// gelen durumu ekrana çizer ve düğmelere basılınca komut gönderir.
// Pencere gizliyken de zamanlayıcı doğru çalışmaya devam eder.

import { api, formatTime, PHASE_LABELS } from './common.js';

const elements = {
  phaseLabel: document.querySelector('#phase-label'),
  time: document.querySelector('#time'),
  ring: document.querySelector('#ring-progress'),
  dots: document.querySelector('#dots'),
  toggle: document.querySelector('#btn-toggle'),
};

// Halkanın çevresi: 2πr (r = 58). Çizginin ne kadarının görüneceğini
// stroke-dashoffset ile ayarlıyoruz.
const RING_LENGTH = 2 * Math.PI * 58;
elements.ring.style.strokeDasharray = String(RING_LENGTH);

function render(state) {
  document.body.dataset.phase = state.phase; // CSS rengi aşamaya göre değiştirir
  elements.phaseLabel.textContent = PHASE_LABELS[state.phase];
  elements.time.textContent = formatTime(state.remainingMs);
  elements.toggle.textContent = state.running ? 'Duraklat' : 'Başlat';

  const remaining = state.remainingMs / state.durationMs; // 1 → 0
  elements.ring.style.strokeDashoffset = String(RING_LENGTH * (1 - remaining));

  // Tur göstergesi: ●●○○ (biten / toplam odak oturumu)
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

// Boşluk tuşu pencere odaktayken başlat/duraklat.
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && event.target === document.body) {
    event.preventDefault();
    api.toggle();
  }
});

api.onState(render);
render(await api.getState());
