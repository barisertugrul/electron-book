// labels.js — Kullanıcının gördüğü metinler ve ad şablonundaki kelimeler.
//
// Bu dosya hem ana süreçte hem işleyicide kullanılır; bu yüzden Node'a ya da
// Electron'a özgü hiçbir şey içe aktarmaz.

export const APP_NAME = 'Toplu Fotoğraf';

// Sayı ve tarih biçimi (ondalık virgül, gün adları).
export const LOCALE = 'tr-TR';

// Ad şablonunda süslü parantez içinde yazılan kelimeler. Soldaki anahtarlar
// kodda kullanılır, sağdakiler kullanıcının yazdığı kelimelerdir:
// "{yıl}-{ay}-{gün}" -> "2026-11-27".
export const NAME_TOKENS = {
  year: 'yıl',
  month: 'ay',
  day: 'gün',
  hour: 'saat',
  minute: 'dakika',
  second: 'saniye',
  counter: 'sıra',
  name: 'ad',
};

export const DEFAULT_TEMPLATE = '{yıl}-{ay}-{gün}_{saat}{dakika}{saniye}';

export const GROUPING_LABELS = {
  none: 'Hepsi tek klasörde',
  year: 'Yıla göre (2026)',
  month: 'Aya göre (2026/2026-11)',
};

export const DIALOG_TEXT = {
  pickPhotos: 'Fotoğrafları seç',
  pickOutput: 'Çıktı klasörünü seç',
  images: 'Fotoğraflar',
};

export const ERRORS = {
  busy: 'Önceki iş henüz bitmedi.',
  noOutput: 'Önce bir çıktı klasörü seçin.',
  noPhotos: 'İşlenecek fotoğraf yok.',
  workerStopped: 'Arka plan işçisi beklenmedik biçimde durdu.',
};
