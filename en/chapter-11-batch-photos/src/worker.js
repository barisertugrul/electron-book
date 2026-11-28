// worker.js — The background worker.
//
// The main process starts this file in a separate process with
// utilityProcess.fork. There are no windows here and no Electron API:
// only Node.js and npm packages. We talk to the main process with messages:
//
//   incoming: { type: 'scan', paths }      Scan the dropped files and folders
//             { type: 'process', jobs, options }  Process the photos
//             { type: 'cancel' }           Stop the running job
//   outgoing: 'scan-progress', 'scan-result', 'progress', 'done', 'error'

import fs from 'node:fs/promises';
import path from 'node:path';

import exifr from 'exifr';
import sharp from 'sharp';

import { collectFiles, findFreePath } from './files.js';

const THUMBNAIL_SIZE = 96;

// sharp keeps the files it opens in a cache for a while. On Windows this can
// leave a processed photo locked, so we turn the cache off.
sharp.cache(false);

let cancelRequested = false;

function send(message) {
  process.parentPort.postMessage(message);
}

// ---------------------------------------------------------------------------
// Scanning: read each photo's date, size and thumbnail
// ---------------------------------------------------------------------------

// The date a photo was taken is stored in its EXIF data. If there is no EXIF
// (a screenshot, an edited image), we use the file's modification date.
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

  // The thumbnail in the preview list. Instead of giving the renderer access
  // to the file itself, we send a small copy as text (a data URL).
  const thumbnail = await sharp(file)
    .autoOrient()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();

  return {
    path: file,
    name: path.basename(file),
    size: stat.size,
    // Photos taken with a phone held upright are stored on their side;
    // autoOrient gives us the width and height as shown on screen.
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
      // A broken or half-downloaded file must not stop the whole job.
      errors.push({ name: path.basename(file), message: error.message });
    }
    send({ type: 'scan-progress', done: index + 1, total: files.length });
  }

  send({ type: 'scan-result', photos, errors, cancelled: cancelRequested });
}

// ---------------------------------------------------------------------------
// Processing: resize, rotate, save under the new name
// ---------------------------------------------------------------------------

async function processPhoto(job, { maxSize, quality, keepMetadata }) {
  const target = await findFreePath(job.target);
  await fs.mkdir(path.dirname(target), { recursive: true });

  let image = sharp(job.source).autoOrient();
  if (maxSize > 0) {
    // Shrink so the longest edge is maxSize; never enlarge a small image.
    image = image.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
  }

  const ext = path.extname(target).toLowerCase();
  if (ext === '.jpg') image = image.jpeg({ quality, mozjpeg: true });
  if (ext === '.webp') image = image.webp({ quality });

  // By default sharp doesn't copy EXIF (location, camera model...).
  // If the user asks, we keep all of it.
  if (keepMetadata) image = image.keepMetadata();

  // We never write to the source file: a new file is always created.
  const info = await image.toFile(target);
  return info.size;
}

async function processAll(jobs, options) {
  const result = { processed: 0, failed: [], bytesIn: 0, bytesOut: 0, cancelled: false };

  for (const [index, job] of jobs.entries()) {
    // The cancel message may have arrived while the previous photo was processed.
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
// Messages from the main process
// ---------------------------------------------------------------------------

process.parentPort.on('message', async ({ data }) => {
  // The running job's loop notices the cancel (the check above).
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
