// plan.js — Which photo goes to which folder, under which name?
//
// We don't touch any files here; we only work out a "plan". The plan is used
// both in the renderer to draw the preview list and in the main process to
// start the real work. These are pure functions, so they are easy to test.

import { DEFAULT_TEMPLATE, LOCALE, NAME_TOKENS } from './labels.js';

export const GROUPINGS = ['none', 'year', 'month'];

// Choices for the longest edge (pixels). 0: keep the original size.
export const MAX_SIZES = [0, 3840, 2560, 1920, 1280, 800];

export const DEFAULT_RULES = {
  template: DEFAULT_TEMPLATE,
  grouping: 'month',
  maxSize: 1920,
  quality: 82,
  keepMetadata: false,
};

// Makes a rules object coming from outside (the renderer) safe:
// drops fields we don't know and fills in missing ones with defaults.
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

// Turns characters that Windows doesn't allow in file names into "-".
// Even if the user types "/" or ".." in the template, nothing can be written
// outside the output folder: the result is always a single file name.
export function sanitizeFileName(name) {
  let clean = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') // Windows drops dots and spaces at the end of a name
    .slice(0, 150);
  // Names like CON, NUL and COM1 are reserved for devices on Windows.
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean)) clean = `${clean}_`;
  return clean;
}

// The values of a photo that can be used in the template.
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

// Replaces {year}, {month}... in the template with the photo's values.
// No extension is added; planOutputs adds it.
export function buildName(template, photo, counter) {
  const values = tokenValues(photo, counter);
  let result = template;
  for (const [key, word] of Object.entries(NAME_TOKENS)) {
    result = result.replaceAll(`{${word}}`, values[key]);
  }
  return sanitizeFileName(result) || values.name;
}

// The subfolder the photo goes to: "", "2026" or "2026/2026-11".
export function groupFolder(photo, grouping) {
  const date = new Date(photo.takenAt);
  const year = String(date.getFullYear());
  if (grouping === 'year') return year;
  if (grouping === 'month') return `${year}/${year}-${pad(date.getMonth() + 1)}`;
  return '';
}

// The plan for all photos. Photos are sorted by the date they were taken,
// and {counter} follows that order. Files that end up with the same name get
// a "-2", "-3" suffix. Target paths always use "/"; the main process turns
// them into the operating system's path format.
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
      // Windows ignores letter case: "A.jpg" and "a.jpg" are the same file.
      used.add(target.toLowerCase());

      return { source: photo.path, target, photo };
    });
}

// The summary above the preview list: how many photos, total size, and how
// many have the date they were taken.
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
