// files.js — Dosya sistemiyle ilgili yardımcılar (yalnızca Node).
//
// Arka plan işçisi bu fonksiyonları kullanır. Electron'a hiç dokunmadıkları
// için testlerde doğrudan çağırabiliriz.

import fs from 'node:fs/promises';
import path from 'node:path';

// İşleyebildiğimiz dosya türleri.
export const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

export function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// Bırakılan yolları fotoğraf listesine çevirir. Klasörlerin içine (alt
// klasörler dahil) bakar, desteklemediğimiz dosyaları atlar. Aynı dosya iki
// kez bırakılsa bile listede bir kez yer alır.
export async function collectFiles(inputPaths) {
  const found = new Set();

  for (const inputPath of inputPaths) {
    const stat = await fs.stat(inputPath).catch(() => null);
    if (!stat) continue; // Silinmiş ya da erişilemeyen yol

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

// "Tatil.jpg" zaten varsa "Tatil-2.jpg", o da varsa "Tatil-3.jpg"...
// Çıktı klasöründe önceki bir işten kalan dosyaların üstüne yazmayız.
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
