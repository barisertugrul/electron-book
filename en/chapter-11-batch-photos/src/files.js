// files.js — File system helpers (Node only).
//
// The background worker uses these functions. They don't touch Electron at
// all, so we can call them directly in tests.

import fs from 'node:fs/promises';
import path from 'node:path';

// The file types we can process.
export const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

export function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// Turns the dropped paths into a list of photos. Looks inside folders
// (subfolders too) and skips files we don't support. Even if the same file
// is dropped twice, it appears in the list once.
export async function collectFiles(inputPaths) {
  const found = new Set();

  for (const inputPath of inputPaths) {
    const stat = await fs.stat(inputPath).catch(() => null);
    if (!stat) continue; // A deleted or inaccessible path

    if (stat.isFile()) {
      if (isSupported(inputPath)) found.add(path.resolve(inputPath));
      continue;
    }

    if (stat.isDirectory()) {
      const entries = await fs.readdir(inputPath, { recursive: true, withFileTypes: true });
      entries
        .filter((entry) => entry.isFile() && isSupported(entry.name))
        .map((entry) => path.resolve(entry.parentPath, entry.name))
        .forEach((file) => found.add(file));
    }
  }

  return [...found].sort();
}

// If "Holiday.jpg" already exists, "Holiday-2.jpg", then "Holiday-3.jpg"...
// We never overwrite files left in the output folder by an earlier job.
export async function findFreePath(filePath) {
  const { dir, name, ext } = path.parse(filePath);
  let candidate = filePath;
  for (let n = 2; await exists(candidate); n++) {
    candidate = path.join(dir, `${name}-${n}${ext}`);
  }
  return candidate;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
