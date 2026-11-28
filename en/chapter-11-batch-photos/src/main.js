// main.js — The main process of Batch Photos.
//
// Here the main process is a "traffic officer": it opens the window, shows
// dialogs, validates requests from the renderer and hands the heavy work
// (reading, resizing and saving photos) to the background worker process.
// It also passes the worker's progress on to the window and the taskbar.

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, utilityProcess } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { APP_NAME, DIALOG_TEXT, ERRORS } from './shared/labels.js';
import { normalizeRules, planOutputs } from './shared/plan.js';

const PAGE = path.join(import.meta.dirname, 'renderer', 'index.html');
const PRELOAD = path.join(import.meta.dirname, 'preload.cjs');
const WORKER = path.join(import.meta.dirname, 'worker.js');
const ICON = path.join(import.meta.dirname, '..', 'assets', 'icon.png');

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'];

let mainWindow = null;
let worker = null; // The background worker; started when the first job comes
let pending = null; // The { resolve, reject } functions of the running job
let outputDir = null; // The output folder the user picked in the dialog

// Scanned photos: path -> info. The main process owns this list; the
// renderer only shows it. (Why? See 'photos:process' below.)
const photos = new Map();

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    title: APP_NAME,
    // The icon of the window and its taskbar button. In a packaged app,
    // Windows and macOS take the icon from the application file anyway;
    // on Linux and during development this line is needed.
    icon: ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f2125' : '#ffffff',
    webPreferences: { preload: PRELOAD },
  });
  mainWindow.loadFile(PAGE);

  // A file dropped outside the drop zone could make the window open that
  // file (and leave our page). We never allow that.
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Background worker
// ---------------------------------------------------------------------------

function getWorker() {
  if (worker) return worker;

  // fork starts worker.js in a separate process. Even if that process
  // crashes, the window and the main process keep running.
  worker = utilityProcess.fork(WORKER, [], { serviceName: 'photo-worker' });
  worker.on('message', handleWorkerMessage);
  worker.on('exit', () => {
    worker = null;
    // If it stopped during a job, return an error to the waiting request.
    pending?.reject(new Error(ERRORS.workerStopped));
    pending = null;
    mainWindow?.setProgressBar(-1);
  });
  return worker;
}

// Gives the worker a job and returns a Promise that resolves when it's done.
// One job at a time: a second request is rejected until the first one ends.
function runInWorker(message) {
  if (pending) return Promise.reject(new Error(ERRORS.busy));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    getWorker().postMessage(message);
  });
}

function handleWorkerMessage(message) {
  switch (message.type) {
    case 'scan-progress':
      mainWindow?.webContents.send('scan:progress', message);
      break;
    case 'progress':
      // A progress bar over the taskbar icon (between 0 and 1).
      mainWindow?.setProgressBar(message.done / message.total);
      mainWindow?.webContents.send('process:progress', message);
      break;
    case 'scan-result':
    case 'done':
      pending?.resolve(message);
      pending = null;
      break;
    case 'error':
      pending?.reject(new Error(message.message));
      pending = null;
      break;
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function scanPaths(paths) {
  if (!Array.isArray(paths) || !paths.every((item) => typeof item === 'string')) {
    throw new Error('Invalid list of paths');
  }
  const result = await runInWorker({ type: 'scan', paths });
  result.photos.forEach((photo) => photos.set(photo.path, photo));
  return { photos: [...photos.values()], errors: result.errors };
}

// Joins a relative path from the plan, like "2026/2026-11/name.jpg", to the
// output folder. planOutputs already cleans the names; still, if we see a path
// that leaves the folder, we stop (one more seat belt).
function resolveTarget(relativeTarget) {
  const target = path.join(outputDir, ...relativeTarget.split('/'));
  if (!target.startsWith(outputDir + path.sep)) {
    throw new Error(`Cannot write outside the output folder: ${relativeTarget}`);
  }
  return target;
}

async function processPhotos(rulesInput) {
  if (!outputDir) throw new Error(ERRORS.noOutput);
  if (photos.size === 0) throw new Error(ERRORS.noPhotos);

  // The renderer sends only the rules; we work out here, from our own list,
  // which file is written where. So even if something goes wrong in the
  // renderer, it cannot make us write a file to any path it likes.
  const rules = normalizeRules(rulesInput);
  const jobs = planOutputs([...photos.values()], rules).map(({ source, target, photo }) => ({
    source,
    target: resolveTarget(target),
    size: photo.size,
  }));

  const startedAt = Date.now();
  try {
    const result = await runInWorker({
      type: 'process',
      jobs,
      options: { maxSize: rules.maxSize, quality: rules.quality, keepMetadata: rules.keepMetadata },
    });
    // If the user switched to another window meanwhile, flash our taskbar
    // icon: "the job is done, look at me".
    if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true);
    return { ...result, elapsedMs: Date.now() - startedAt, outputDir };
  } finally {
    mainWindow?.setProgressBar(-1); // -1: remove the bar
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

const TRUSTED_URL = pathToFileURL(PAGE).href;

// As in Chapter 6, we check the sending page. We also return errors as an
// { error } object so the renderer can show the user a plain message.
function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame?.url !== TRUSTED_URL) throw new Error(`Untrusted sender: ${channel}`);
    try {
      return await listener(...args);
    } catch (error) {
      return { error: error.message };
    }
  });
}

function registerIpcHandlers() {
  // The page asks for the current state when it opens (or reloads with Ctrl+R).
  handle('state:get', () => ({ photos: [...photos.values()], outputDir }));

  handle('photos:pick', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: DIALOG_TEXT.pickPhotos,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: DIALOG_TEXT.images, extensions: IMAGE_EXTENSIONS }],
    });
    return canceled ? [] : filePaths;
  });

  handle('photos:scan', (paths) => scanPaths(paths));

  handle('photos:remove', (photoPath) => {
    photos.delete(photoPath);
    return [...photos.values()];
  });

  handle('photos:clear', () => {
    photos.clear();
    return [];
  });

  handle('output:pick', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: DIALOG_TEXT.pickOutput,
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (!canceled) outputDir = filePaths[0];
    return outputDir;
  });

  // Opens only the output folder the user picked; the renderer cannot send
  // a path.
  handle('output:open', () => outputDir && shell.openPath(outputDir));

  handle('photos:process', (rules) => processPhotos(rules));

  // Cancel is not a request but a notice: we don't expect a reply.
  ipcMain.on('work:cancel', (event) => {
    if (event.senderFrame?.url === TRUSTED_URL) worker?.postMessage({ type: 'cancel' });
  });
}

// ---------------------------------------------------------------------------
// Application lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// When the app quits, the worker quits too.
app.on('will-quit', () => {
  worker?.kill();
});
