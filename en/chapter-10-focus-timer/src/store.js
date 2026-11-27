// store.js — Two helpers for keeping small data in a JSON file.
//
// Settings and daily statistics live in the user's "app data" folder:
// app.getPath('userData'). This folder differs on every operating system
// (for example %APPDATA%\Focus Timer on Windows). main.js provides the folder
// path; this file only does the reading and writing.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Reads the file and parses it as JSON. If the file is missing or broken it
// returns `fallback`: the app has to work on its very first start too.
export async function readJson(filePath, fallback) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Writes the data to a temporary file first, then puts it in place of the
// real file. If writing is interrupted (power cut, app crash) the old file
// stays intact.
export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await rename(tempPath, filePath);
}
