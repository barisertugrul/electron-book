// store.js — Küçük verileri JSON dosyasında saklamak için iki yardımcı.
//
// Ayarlar ve günlük istatistikler, kullanıcının "uygulama verisi" klasöründe
// durur: app.getPath('userData'). Bu klasör her işletim sisteminde farklıdır
// (Windows'ta %APPDATA%\Odak Zamanlayıcı gibi). Klasörün yolunu main.js verir;
// bu dosya yalnızca okuma ve yazma işini yapar.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Dosyayı okur ve JSON olarak çözer. Dosya yoksa ya da bozuksa
// `fallback` değerini döndürür: uygulama ilk açılışta da çalışmalı.
export async function readJson(filePath, fallback) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Veriyi önce geçici bir dosyaya yazar, sonra asıl dosyanın yerine koyar.
// Yazma yarıda kesilirse (elektrik gitti, uygulama çöktü) eski dosya
// bozulmadan kalır.
export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await rename(tempPath, filePath);
}
