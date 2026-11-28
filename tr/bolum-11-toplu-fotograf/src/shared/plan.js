// plan.js — Hangi fotoğraf hangi adla, hangi klasöre gidecek?
//
// Burada dosyalara dokunmuyoruz; yalnızca bir "plan" çıkarıyoruz. Plan hem
// işleyicide önizleme listesini çizmek için hem de ana süreçte gerçek işi
// başlatmak için kullanılır. Saf fonksiyonlar olduğu için test etmesi kolay.

import { DEFAULT_TEMPLATE, LOCALE, NAME_TOKENS } from './labels.js';

export const GROUPINGS = ['none', 'year', 'month'];

// En uzun kenar için seçenekler (piksel). 0: boyutu değiştirme.
export const MAX_SIZES = [0, 3840, 2560, 1920, 1280, 800];

export const DEFAULT_RULES = {
  template: DEFAULT_TEMPLATE,
  grouping: 'month',
  maxSize: 1920,
  quality: 82,
  keepMetadata: false,
};

// Dışarıdan (işleyiciden) gelen kural nesnesini güvenli hale getirir:
// tanımadığımız alanları atar, eksikleri varsayılanla doldurur.
export function normalizeRules(input = {}) {
  const rules = { ...DEFAULT_RULES };
  if (typeof input.template === 'string' && input.template.trim() !== '') {
    rules.template = input.template.slice(0, 200);
  }
  if (GROUPINGS.includes(input.grouping)) rules.grouping = input.grouping;
  if (MAX_SIZES.includes(input.maxSize)) rules.maxSize = input.maxSize;
  if (Number.isInteger(input.quality)) {
    rules.quality = Math.min(100, Math.max(40, input.quality));
  }
  rules.keepMetadata = input.keepMetadata === true;
  return rules;
}

const pad = (value, length = 2) => String(value).padStart(length, '0');

// "IMG_2041.JPG" -> { base: "IMG_2041", ext: ".jpg" }
export function splitName(fileName) {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return { base: fileName, ext: '' };
  let ext = fileName.slice(dot).toLowerCase();
  if (ext === '.jpeg') ext = '.jpg';
  return { base: fileName.slice(0, dot), ext };
}

// Windows'ta dosya adında kullanılamayan karakterleri "-" yapar.
// Kullanıcı şablona "/" ya da ".." yazsa bile çıktı klasörünün dışına
// dosya yazamaz: ad her zaman tek bir dosya adı olarak kalır.
export function sanitizeFileName(name) {
  let clean = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') // Windows adın sonundaki nokta ve boşluğu siler
    .slice(0, 150);
  // CON, NUL, COM1 gibi adlar Windows'ta aygıtlara ayrılmıştır.
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean)) clean = `${clean}_`;
  return clean;
}

// Bir fotoğrafın şablonda kullanılabilecek değerleri.
export function tokenValues(photo, counter) {
  const date = new Date(photo.takenAt);
  return {
    year: date.getFullYear(),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
    second: pad(date.getSeconds()),
    counter: pad(counter, 3),
    name: splitName(photo.name).base,
  };
}

// Şablondaki {yıl}, {ay}... kelimelerini fotoğrafın değerleriyle değiştirir.
// Uzantı eklenmez; onu planOutputs ekler.
export function buildName(template, photo, counter) {
  const values = tokenValues(photo, counter);
  let result = template;
  for (const [key, word] of Object.entries(NAME_TOKENS)) {
    result = result.replaceAll(`{${word}}`, values[key]);
  }
  return sanitizeFileName(result) || values.name;
}

// Fotoğrafın gideceği alt klasör: "", "2026" ya da "2026/2026-11".
export function groupFolder(photo, grouping) {
  const date = new Date(photo.takenAt);
  const year = String(date.getFullYear());
  if (grouping === 'year') return year;
  if (grouping === 'month') return `${year}/${year}-${pad(date.getMonth() + 1)}`;
  return '';
}

// Bütün fotoğrafların planı. Fotoğraflar çekim tarihine göre sıralanır,
// {sıra} da bu sırayı izler. Aynı ada düşen dosyalar "-2", "-3" ekiyle ayrılır.
// Hedef yollar her zaman "/" ile yazılır; ana süreç bunu işletim sisteminin
// yol biçimine çevirir.
export function planOutputs(photos, rules) {
  const used = new Set();
  return photos
    .toSorted((a, b) => new Date(a.takenAt) - new Date(b.takenAt))
    .map((photo, index) => {
      const folder = groupFolder(photo, rules.grouping);
      const base = buildName(rules.template, photo, index + 1);
      const { ext } = splitName(photo.name);

      let target = folder ? `${folder}/${base}${ext}` : `${base}${ext}`;
      for (let n = 2; used.has(target.toLowerCase()); n++) {
        target = folder ? `${folder}/${base}-${n}${ext}` : `${base}-${n}${ext}`;
      }
      // Windows büyük-küçük harfi ayırmaz: "A.jpg" ile "a.jpg" aynı dosyadır.
      used.add(target.toLowerCase());

      return { source: photo.path, target, photo };
    });
}

// Önizleme listesinin üstündeki özet: kaç fotoğraf, toplam boyut, kaçında
// çekim tarihi var.
export function summarize(photos) {
  return {
    count: photos.length,
    totalBytes: photos.reduce((sum, photo) => sum + photo.size, 0),
    withExifDate: photos.filter((photo) => photo.dateSource === 'exif').length,
  };
}

// 48211968 -> "46 MB"
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  const digits = value < 10 ? 1 : 0;
  const number = value.toLocaleString(LOCALE, { maximumFractionDigits: digits });
  return `${number} ${units[unit]}`;
}
