// stats.js — Focus statistics for the daily summary.
//
// Data format (stats.json):
// { "days": { "2026-11-27": { "sessions": 3, "focusMinutes": 75 }, ... } }
//
// These functions don't change the data; they return a new object every time.
// main.js does the writing to disk.

// A "YYYY-MM-DD" key in local time. We don't use toISOString(): it works in
// UTC and shifts the day for times close to midnight.
export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Adds a finished focus session to its day.
export function recordFocusSession(stats, minutes, date = new Date()) {
  const key = dateKey(date);
  const days = { ...(stats?.days ?? {}) };
  const today = days[key] ?? { sessions: 0, focusMinutes: 0 };
  days[key] = {
    sessions: today.sessions + 1,
    focusMinutes: today.focusMinutes + minutes,
  };
  return { days };
}

// The last `count` days including today, oldest first.
// Days without a record come back as zero; the chart shows an empty column.
export function lastDays(stats, count = 7, today = new Date()) {
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = dateKey(date);
    const day = stats?.days?.[key] ?? { sessions: 0, focusMinutes: 0 };
    result.push({ date: key, ...day });
  }
  return result;
}
