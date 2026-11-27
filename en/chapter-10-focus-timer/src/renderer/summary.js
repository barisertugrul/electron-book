// summary.js — The daily summary window: today's numbers and a 7-day chart.
//
// We don't use a library for the chart: each day is a <div> whose height is
// proportional to that day's minutes. That is plenty for seven columns.

import { api, closeOnEscape } from './common.js';

// "2026-11-27" -> "Fri". We build the date in local time (like dateKey in stats.js).
const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
function weekdayName(key) {
  const [year, month, day] = key.split('-').map(Number);
  return weekdayFormat.format(new Date(year, month - 1, day));
}

function render(days) {
  const today = days.at(-1); // The list runs from the oldest day to today
  document.querySelector('#today-sessions').textContent = today.sessions;
  document.querySelector('#today-minutes').textContent = today.focusMinutes;

  const weekTotal = days.reduce((sum, day) => sum + day.focusMinutes, 0);
  document.querySelector('#week-total').textContent = `· ${weekTotal} min in total`;

  // The tallest column fills the chart. With no records, don't divide by 0.
  const max = Math.max(...days.map((day) => day.focusMinutes), 1);

  const columns = days.map((day) => {
    const column = document.createElement('div');
    column.className = day === today ? 'column today' : 'column';
    column.title = `${day.date}: ${day.sessions} sessions, ${day.focusMinutes} min`;

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

// If a focus session ends while the window is open, the chart refreshes itself.
api.onStatsChanged(async () => render(await api.getStats()));
render(await api.getStats());
