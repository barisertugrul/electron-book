// stats.js — Günlük özet için odak istatistikleri.
//
// Veri biçimi (stats.json):
// { "days": { "2026-11-27": { "sessions": 3, "focusMinutes": 75 }, ... } }
//
// Bu fonksiyonlar veriyi değiştirmez; her seferinde yeni bir nesne döndürür.
// Diske yazma işini main.js yapar.

// Yerel saate göre "YYYY-AA-GG" anahtarı. toISOString() kullanmıyoruz:
// o UTC'ye göre çalışır ve gece yarısına yakın saatlerde günü kaydırır.
export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Biten bir odak oturumunu o güne ekler.
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

// Bugün dahil son `count` günün listesi, en eski gün başta.
// Kaydı olmayan günler sıfır olarak gelir; grafikte boş sütun görünür.
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
