// settings.js — Ayarların varsayılan değerleri ve doğrulanması.
//
// Ayarlar dosyası diskte düz metin olarak durur; kullanıcı elle değiştirebilir
// ya da dosya bozulabilir. Arayüzden gelen değerlere de körü körüne
// güvenmeyiz. Bu yüzden her ayarı okurken ve kaydederken buradan geçiririz.

export const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: false, // Aşama bitince sonrakini kendiliğinden başlat
  alwaysOnTop: true, // Mini pencere diğer pencerelerin üstünde dursun
  openAtLogin: false, // Bilgisayar açılınca uygulamayı başlat
};

// Sayısal ayarların izin verilen aralıkları.
const LIMITS = {
  focusMinutes: [1, 120],
  shortBreakMinutes: [1, 30],
  longBreakMinutes: [1, 60],
  sessionsBeforeLongBreak: [2, 8],
};

function clampInteger(value, [min, max], fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

// Ne gelirse gelsin geçerli bir ayar nesnesi döndürür:
// eksik alanlar varsayılanla doldurulur, aralık dışı sayılar sınıra çekilir,
// tanımadığımız alanlar atılır.
export function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = {};

  for (const [key, limits] of Object.entries(LIMITS)) {
    result[key] = clampInteger(source[key], limits, DEFAULT_SETTINGS[key]);
  }
  for (const key of ['autoStartNext', 'alwaysOnTop', 'openAtLogin']) {
    result[key] = typeof source[key] === 'boolean' ? source[key] : DEFAULT_SETTINGS[key];
  }
  return result;
}
