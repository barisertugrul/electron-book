// settings.js — Default settings and their validation.
//
// The settings file sits on disk as plain text; the user may edit it by hand
// or it may get corrupted. We don't blindly trust values coming from the UI
// either. That is why every setting passes through here when read and saved.

export const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: false, // Start the next phase automatically when one ends
  alwaysOnTop: true, // Keep the mini window above other windows
  openAtLogin: false, // Start the app when the computer starts
};

// Allowed ranges of the numeric settings.
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

// Whatever comes in, returns a valid settings object:
// missing fields get their default, out-of-range numbers are pulled to the
// limit, unknown fields are dropped.
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
