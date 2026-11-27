// document.js — Small helper functions about the open document.
//
// These functions do not depend on Electron; they only take data and return
// data. That lets us test them with plain Node.js, without starting Electron.

import path from 'node:path';

export const APP_NAME = 'Quick Note';
export const UNTITLED = 'Untitled';

// Extracts the name to show on screen from a file path.
// "C:\\Notes\\shopping.md" -> "shopping.md"
export function getDisplayName(filePath) {
  if (!filePath) return UNTITLED;
  // Check both separators so Windows paths also work on Linux/macOS.
  return path.win32.basename(path.posix.basename(filePath));
}

// Builds the window title. Adds "•" in front if there are unsaved changes.
// Example: "• shopping.md — Quick Note"
export function buildWindowTitle(filePath, isDirty) {
  const mark = isDirty ? '• ' : '';
  return `${mark}${getDisplayName(filePath)} — ${APP_NAME}`;
}
