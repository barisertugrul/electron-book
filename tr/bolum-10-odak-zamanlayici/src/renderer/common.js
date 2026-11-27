// common.js — Üç sayfanın ortak kullandığı küçük yardımcılar.

export const api = window.focusTimer;

export const PHASE_LABELS = {
  focus: 'Odak',
  shortBreak: 'Kısa mola',
  longBreak: 'Uzun mola',
};

// 1500000 ms -> "25:00" (timer.js'teki fonksiyonun aynısı; işleyici süreç
// ana süreçteki dosyaları içe aktaramaz, bu yüzden burada da var).
export function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Escape tuşu pencereyi kapatsın (ayarlar ve özet pencerelerinde).
export function closeOnEscape() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') api.closeWindow();
  });
}
