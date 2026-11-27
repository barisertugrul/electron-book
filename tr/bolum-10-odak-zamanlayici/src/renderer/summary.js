// summary.js — Günlük özet penceresi: bugünün sayıları ve son 7 günün grafiği.
//
// Grafik için kütüphane kullanmıyoruz: her gün bir <div>, yüksekliği o günün
// dakikasıyla orantılı. Yedi sütun için bu kadarı yeterli.

import { api, closeOnEscape } from './common.js';

// "2026-11-27" -> "Cum". Tarihi yerel saatle kuruyoruz (stats.js'teki dateKey gibi).
const weekdayFormat = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
function weekdayName(key) {
  const [year, month, day] = key.split('-').map(Number);
  return weekdayFormat.format(new Date(year, month - 1, day));
}

function render(days) {
  const today = days.at(-1); // Liste en eski günden bugüne sıralı
  document.querySelector('#today-sessions').textContent = today.sessions;
  document.querySelector('#today-minutes').textContent = today.focusMinutes;

  const weekTotal = days.reduce((sum, day) => sum + day.focusMinutes, 0);
  document.querySelector('#week-total').textContent = `· toplam ${weekTotal} dk`;

  // En yüksek sütun grafiğin tamamını doldursun. Hiç kayıt yoksa 0'a bölmeyelim.
  const max = Math.max(...days.map((day) => day.focusMinutes), 1);

  const columns = days.map((day) => {
    const column = document.createElement('div');
    column.className = day === today ? 'column today' : 'column';
    column.title = `${day.date}: ${day.sessions} oturum, ${day.focusMinutes} dk`;

    const value = document.createElement('span');
    value.className = 'column-value';
    value.textContent = day.focusMinutes > 0 ? day.focusMinutes : '';

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${(day.focusMinutes / max) * 100}%`;

    const label = document.createElement('span');
    label.className = 'column-label';
    label.textContent = weekdayName(day.date);

    const barArea = document.createElement('div');
    barArea.className = 'bar-area';
    barArea.append(value, bar);
    column.append(barArea, label);
    return column;
  });

  document.querySelector('#chart').replaceChildren(...columns);
}

document.querySelector('#btn-close').addEventListener('click', () => api.closeWindow());
closeOnEscape();

// Pencere açıkken bir odak oturumu biterse grafik kendini yeniler.
api.onStatsChanged(async () => render(await api.getStats()));
render(await api.getStats());
