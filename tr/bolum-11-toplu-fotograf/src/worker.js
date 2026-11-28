// worker.js — Arka plan işçisi.
//
// Ana süreç bu dosyayı utilityProcess.fork ile ayrı bir süreçte başlatır.
// Burada pencere yok, Electron API'si de yok: yalnızca Node.js ve npm
// paketleri var. Ana süreçle mesajlaşarak konuşuruz:
//
//   gelen:  { type: 'scan', paths }      Bırakılan dosya ve klasörleri tara
//           { type: 'process', jobs, options }  Fotoğrafları işle
//           { type: 'cancel' }           Süren işi yarıda kes
//   giden:  'scan-progress', 'scan-result', 'progress', 'done', 'error'

import fs from 'node:fs/promises';
import path from 'node:path';

import exifr from 'exifr';
import sharp from 'sharp';

import { collectFiles, findFreePath } from './files.js';

const THUMBNAIL_SIZE = 96;

// sharp açtığı dosyaları bir süre önbellekte tutar. Windows'ta bu, işlenen
// fotoğrafın kilitli kalmasına yol açabilir; önbelleği kapatıyoruz.
sharp.cache(false);

let cancelRequested = false;

function send(message) {
  process.parentPort.postMessage(message);
}

// ---------------------------------------------------------------------------
// Tarama: her fotoğrafın tarihini, boyutunu ve küçük resmini çıkar
// ---------------------------------------------------------------------------

// Fotoğrafın çekildiği tarih EXIF bilgisinde yazar. EXIF yoksa (ekran
// görüntüsü, düzenlenmiş resim) dosyanın değiştirilme tarihini kullanırız.
async function readTakenAt(file, stat) {
  const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null);
  const date = exif?.DateTimeOriginal ?? exif?.CreateDate;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return { takenAt: date, dateSource: 'exif' };
  }
  return { takenAt: stat.mtime, dateSource: 'file' };
}

async function readPhoto(file) {
  const stat = await fs.stat(file);
  const metadata = await sharp(file).metadata();
  const { takenAt, dateSource } = await readTakenAt(file, stat);

  // Önizleme listesindeki küçük resim. Dosyanın kendisini işleyiciye
  // açmak yerine küçük bir kopyasını metin (data URL) olarak gönderiyoruz.
  const thumbnail = await sharp(file)
    .autoOrient()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();

  return {
    path: file,
    name: path.basename(file),
    size: stat.size,
    // Telefonla dik çekilen fotoğraflar yan yatmış saklanır; autoOrient
    // bize fotoğrafın ekranda görüneceği en ve boyu verir.
    width: metadata.autoOrient.width,
    height: metadata.autoOrient.height,
    takenAt: takenAt.toISOString(),
    dateSource,
    thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
  };
}

async function scan(inputPaths) {
  const files = await collectFiles(inputPaths);
  const photos = [];
  const errors = [];

  for (const [index, file] of files.entries()) {
    if (cancelRequested) break;
    try {
      photos.push(await readPhoto(file));
    } catch (error) {
      // Bozuk ya da yarım inmiş bir dosya bütün işi durdurmasın.
      errors.push({ name: path.basename(file), message: error.message });
    }
    send({ type: 'scan-progress', done: index + 1, total: files.length });
  }

  send({ type: 'scan-result', photos, errors, cancelled: cancelRequested });
}

// ---------------------------------------------------------------------------
// İşleme: küçült, döndür, yeni adıyla kaydet
// ---------------------------------------------------------------------------

async function processPhoto(job, { maxSize, quality, keepMetadata }) {
  const target = await findFreePath(job.target);
  await fs.mkdir(path.dirname(target), { recursive: true });

  let image = sharp(job.source).autoOrient();
  if (maxSize > 0) {
    // En uzun kenar maxSize olacak biçimde küçült; küçük resmi büyütme.
    image = image.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
  }

  const ext = path.extname(target).toLowerCase();
  if (ext === '.jpg') image = image.jpeg({ quality, mozjpeg: true });
  if (ext === '.webp') image = image.webp({ quality });

  // sharp varsayılan olarak EXIF'i (konum, kamera modeli...) kopyalamaz.
  // Kullanıcı isterse hepsini koruyoruz.
  if (keepMetadata) image = image.keepMetadata();

  // Kaynak dosyaya hiç yazmıyoruz: her zaman yeni bir dosya oluşur.
  const info = await image.toFile(target);
  return info.size;
}

async function processAll(jobs, options) {
  const result = { processed: 0, failed: [], bytesIn: 0, bytesOut: 0, cancelled: false };

  for (const [index, job] of jobs.entries()) {
    // İptal mesajı, bir önceki fotoğraf işlenirken gelmiş olabilir.
    if (cancelRequested) {
      result.cancelled = true;
      break;
    }
    const name = path.basename(job.source);
    try {
      result.bytesOut += await processPhoto(job, options);
      result.bytesIn += job.size;
      result.processed++;
    } catch (error) {
      result.failed.push({ name, message: error.message });
    }
    send({ type: 'progress', done: index + 1, total: jobs.length, current: name });
  }

  send({ type: 'done', ...result });
}

// ---------------------------------------------------------------------------
// Ana süreçten gelen mesajlar
// ---------------------------------------------------------------------------

process.parentPort.on('message', async ({ data }) => {
  // İptal, süren işin döngüsünde fark edilir (yukarıdaki kontrol).
  if (data.type === 'cancel') {
    cancelRequested = true;
    return;
  }

  cancelRequested = false;
  try {
    if (data.type === 'scan') await scan(data.paths);
    if (data.type === 'process') await processAll(data.jobs, data.options);
  } catch (error) {
    send({ type: 'error', message: error.message });
  }
});
