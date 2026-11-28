// main.js — Toplu Fotoğraf'ın ana süreci.
//
// Ana süreç burada bir "trafik polisi": pencereyi açar, diyalogları gösterir,
// işleyiciden gelen istekleri doğrular ve asıl ağır işi (fotoğraf okumak,
// küçültmek, kaydetmek) arka plandaki işçi sürece verir. İşçiden gelen
// ilerleme bilgisini de pencereye ve görev çubuğuna iletir.

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
let worker = null; // Arka plan işçisi; ilk iş gelince başlatılır
let pending = null; // Süren işin { resolve, reject } fonksiyonları
let outputDir = null; // Kullanıcının diyalogla seçtiği çıktı klasörü

// Taranan fotoğraflar: yol -> bilgi. Listenin asıl sahibi ana süreç;
// işleyici yalnızca gösterir. (Neden? Aşağıdaki 'photos:process'e bakın.)
const photos = new Map();

// ---------------------------------------------------------------------------
// Pencere
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    title: APP_NAME,
    // Pencerenin ve görev çubuğu düğmesinin simgesi. Windows ve macOS
    // paketlenmiş uygulamada simgeyi zaten uygulama dosyasından alır;
    // Linux'ta ve geliştirme sırasında bu satır gerekir.
    icon: ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f2125' : '#ffffff',
    webPreferences: { preload: PRELOAD },
  });
  mainWindow.loadFile(PAGE);

  // Bırakma alanının dışına bırakılan bir dosya, pencerenin o dosyayı
  // açmasına (sayfamızdan ayrılmasına) yol açabilir. Buna hiç izin vermiyoruz.
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Arka plan işçisi
// ---------------------------------------------------------------------------

function getWorker() {
  if (worker) return worker;

  // fork, worker.js'i ayrı bir süreçte başlatır. Bu süreç çökse bile
  // pencere ve ana süreç çalışmaya devam eder.
  worker = utilityProcess.fork(WORKER, [], { serviceName: 'photo-worker' });
  worker.on('message', handleWorkerMessage);
  worker.on('exit', () => {
    worker = null;
    // Bir iş sürerken durduysa, bekleyen isteğe hata döndür.
    pending?.reject(new Error(ERRORS.workerStopped));
    pending = null;
    mainWindow?.setProgressBar(-1);
  });
  return worker;
}

// İşçiye bir iş verir ve iş bitince çözülen bir Promise döndürür.
// Aynı anda tek iş: ikinci istek, birincisi bitene kadar reddedilir.
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
      // Görev çubuğundaki simgenin üstünde ilerleme çubuğu (0 ile 1 arası).
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
// İşler
// ---------------------------------------------------------------------------

async function scanPaths(paths) {
  if (!Array.isArray(paths) || !paths.every((item) => typeof item === 'string')) {
    throw new Error('Geçersiz yol listesi');
  }
  const result = await runInWorker({ type: 'scan', paths });
  result.photos.forEach((photo) => photos.set(photo.path, photo));
  return { photos: [...photos.values()], errors: result.errors };
}

// Plandaki "2026/2026-11/ad.jpg" gibi göreli yolu çıktı klasörüne bağlar.
// planOutputs adları zaten temizliyor; yine de klasörün dışına çıkan bir yol
// görürsek işi durdururuz (bir güvenlik kemeri daha).
function resolveTarget(relativeTarget) {
  const target = path.join(outputDir, ...relativeTarget.split('/'));
  if (!target.startsWith(outputDir + path.sep)) {
    throw new Error(`Çıktı klasörünün dışına yazılamaz: ${relativeTarget}`);
  }
  return target;
}

async function processPhotos(rulesInput) {
  if (!outputDir) throw new Error(ERRORS.noOutput);
  if (photos.size === 0) throw new Error(ERRORS.noPhotos);

  // İşleyici yalnızca kuralları gönderir; hangi dosyanın nereye yazılacağını
  // burada, kendi listemizden hesaplarız. Böylece işleyiciye bir şey olsa
  // bile diskte istediği yola dosya yazdıramaz.
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
    // Kullanıcı bu arada başka bir pencereye geçtiyse görev çubuğunda
    // simgemiz yanıp sönsün: "iş bitti, bana bak".
    if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true);
    return { ...result, elapsedMs: Date.now() - startedAt, outputDir };
  } finally {
    mainWindow?.setProgressBar(-1); // -1: çubuğu kaldır
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

const TRUSTED_URL = pathToFileURL(PAGE).href;

// Bölüm 6'daki gibi gönderen sayfayı kontrol ediyoruz. Hataları da
// { error } nesnesi olarak döndürüyoruz ki işleyici kullanıcıya düz bir
// mesaj gösterebilsin.
function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame?.url !== TRUSTED_URL) throw new Error(`Güvenilmeyen gönderici: ${channel}`);
    try {
      return await listener(...args);
    } catch (error) {
      return { error: error.message };
    }
  });
}

function registerIpcHandlers() {
  // Sayfa açılınca (ya da Ctrl+R ile yenilenince) güncel durumu ister.
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

  // Yalnızca kullanıcının seçtiği çıktı klasörünü açar; işleyici bir yol
  // gönderemez.
  handle('output:open', () => outputDir && shell.openPath(outputDir));

  handle('photos:process', (rules) => processPhotos(rules));

  // İptal bir istek değil, bir haber: cevap beklemiyoruz.
  ipcMain.on('work:cancel', (event) => {
    if (event.senderFrame?.url === TRUSTED_URL) worker?.postMessage({ type: 'cancel' });
  });
}

// ---------------------------------------------------------------------------
// Uygulama yaşam döngüsü
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

// Uygulama kapanırken işçi de kapansın.
app.on('will-quit', () => {
  worker?.kill();
});
