// main.js — Odak Zamanlayıcı'nın ana süreci.
//
// Bu uygulama Hızlı Not'tan farklı olarak penceresi kapalıyken de çalışır:
// zamanlayıcı ana süreçte döner, uygulama sistem tepsisinde (saatin yanında)
// bekler. Pencereler yalnızca zamanlayıcıyı göstermek ve ayarları değiştirmek
// için vardır.

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  screen,
  Tray,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { APP_NAME, PHASE_LABELS, phaseEndMessage, TRAY_TEXT, WINDOW_TITLES } from './labels.js';
import { normalizeSettings } from './settings.js';
import { lastDays, recordFocusSession } from './stats.js';
import { readJson, writeJson } from './store.js';
import { FocusTimer, formatTime } from './timer.js';

// ---------------------------------------------------------------------------
// Tek örnek kilidi: uygulama ikinci kez açılmasın
// ---------------------------------------------------------------------------

// İki zamanlayıcı aynı anda çalışırsa iki tepsi simgesi, iki bildirim olur.
// Kilidi alamazsak başka bir kopya zaten çalışıyor demektir: hemen çıkarız.
// O kopyaya 'second-instance' olayı gider (aşağıda dinliyoruz).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---------------------------------------------------------------------------
// Dosya yolları ve uygulama durumu
// ---------------------------------------------------------------------------

const RENDERER_DIR = path.join(import.meta.dirname, 'renderer');
const PRELOAD = path.join(import.meta.dirname, 'preload.cjs');
const ASSETS_DIR = path.join(import.meta.dirname, '..', 'assets');

const PAGES = {
  timer: path.join(RENDERER_DIR, 'timer.html'),
  settings: path.join(RENDERER_DIR, 'settings.html'),
  summary: path.join(RENDERER_DIR, 'summary.html'),
};

// Windows'ta bildirimlerin doğru uygulama adıyla görünmesi için gerekli.
const APP_ID = 'com.ertyazilim.odak-zamanlayici';

// Her yerden başlat/duraklat kısayolu (uygulama arka plandayken bile çalışır).
const TOGGLE_SHORTCUT = 'CommandOrControl+Alt+P';

let settingsFile; // app hazır olunca belli olur (userData klasörü)
let statsFile;
let settings;
let stats;
let timer;
let tray = null;
let shortcutRegistered = false;
let isQuitting = false; // true ise pencereler gizlenmez, gerçekten kapanır
let lastShownTime = ''; // Tepsi ipucunu her saniyede yalnızca bir kez günceller

const windows = { timer: null, settings: null, summary: null };

// ---------------------------------------------------------------------------
// Pencereler
// ---------------------------------------------------------------------------

// Sayfa yüklenene kadar görünen arka plan rengi; temaya uysun ki beyaz/siyah
// bir an parlamasın.
function windowBackground() {
  return nativeTheme.shouldUseDarkColors ? '#1f2125' : '#ffffff';
}

const webPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
};

// Mini zamanlayıcı: çerçevesiz, küçük, isteğe bağlı olarak her zaman üstte.
function createTimerWindow({ show = true } = {}) {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 300;
  const height = 210;

  const win = new BrowserWindow({
    width,
    height,
    // Ekranın sağ alt köşesine, görev çubuğunun hemen üstüne yerleştir.
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
    frame: false, // Başlık çubuğu ve kenarlık yok; sürükleme alanını CSS ile veriyoruz
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true, // Görev çubuğunda yer kaplamasın; tepsi simgesi yeter
    alwaysOnTop: settings.alwaysOnTop,
    show: false,
    title: APP_NAME,
    backgroundColor: windowBackground(),
    webPreferences,
  });

  win.loadFile(PAGES.timer);
  if (show) win.once('ready-to-show', () => win.show());

  // Kapat düğmesi pencereyi yok etmez, gizler. Zamanlayıcı ana süreçte
  // çalışmaya devam eder. Yalnızca "Çıkış" seçilince gerçekten kapanır.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    windows.timer = null;
  });

  windows.timer = win;
}

function showTimerWindow() {
  if (!windows.timer) createTimerWindow();
  windows.timer.show();
  windows.timer.focus();
}

function toggleTimerWindow() {
  if (windows.timer?.isVisible()) windows.timer.hide();
  else showTimerWindow();
}

// Ayarlar ve günlük özet: sıradan pencereler. Açıksa yenisini açmayız, öne getiririz.
function openWindow(name) {
  if (windows[name]) {
    windows[name].show();
    windows[name].focus();
    return;
  }
  const win = new BrowserWindow({
    width: name === 'settings' ? 420 : 480,
    height: name === 'settings' ? 520 : 440,
    useContentSize: true, // Boyutlar kenarlık hariç sayfa alanı için
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: WINDOW_TITLES[name],
    show: false,
    backgroundColor: windowBackground(),
    webPreferences,
  });
  win.loadFile(PAGES[name]);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    windows[name] = null;
  });
  windows[name] = win;
}

// Açık olan bütün pencerelerimize aynı mesajı gönderir.
function broadcast(channel, data) {
  for (const win of Object.values(windows)) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  }
}

// ---------------------------------------------------------------------------
// Sistem tepsisi
// ---------------------------------------------------------------------------

// Odak sırasında kırmızı, molada yeşil simge. Dosya adının @2x sürümü
// yüksek çözünürlüklü ekranlarda kendiliğinden kullanılır.
const trayIcons = {};
function trayIcon(phase) {
  const name = phase === 'focus' ? 'tray-focus.png' : 'tray-break.png';
  trayIcons[name] ??= nativeImage.createFromPath(path.join(ASSETS_DIR, name));
  return trayIcons[name];
}

function createTray() {
  tray = new Tray(trayIcon(timer.phase));
  // Windows ve Linux'ta simgeye tıklamak mini pencereyi açar/kapatır.
  tray.on('click', toggleTimerWindow);
  updateTray(timer.getState());
}

// Tepsi menüsünü duruma göre yeniden kurar (Başlat ↔ Duraklat gibi).
function updateTray(state) {
  if (!tray) return;
  const status = state.running ? TRAY_TEXT.running : TRAY_TEXT.paused;

  const menu = Menu.buildFromTemplate([
    { label: `${PHASE_LABELS[state.phase]} — ${status}`, enabled: false },
    { type: 'separator' },
    {
      label: state.running ? TRAY_TEXT.pause : TRAY_TEXT.start,
      accelerator: TOGGLE_SHORTCUT,
      click: () => timer.toggle(),
    },
    { label: TRAY_TEXT.reset, click: () => timer.reset() },
    { label: TRAY_TEXT.skip, click: () => timer.skip() },
    { type: 'separator' },
    { label: TRAY_TEXT.showTimer, click: showTimerWindow },
    { label: TRAY_TEXT.summary, click: () => openWindow('summary') },
    { label: TRAY_TEXT.settings, click: () => openWindow('settings') },
    { type: 'separator' },
    { label: TRAY_TEXT.quit, click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.setImage(trayIcon(state.phase));
  updateTrayTime(state, true);
}

// Fare simgenin üstündeyken görünen ipucu: "Odak — 24:13".
// macOS'ta süre, simgenin yanında menü çubuğunda da yazar.
function updateTrayTime(state, force = false) {
  const time = formatTime(state.remainingMs);
  if (!force && time === lastShownTime) return;
  lastShownTime = time;
  tray.setToolTip(`${APP_NAME}\n${PHASE_LABELS[state.phase]} — ${time}`);
  if (process.platform === 'darwin') tray.setTitle(time);
}

// ---------------------------------------------------------------------------
// Bildirimler
// ---------------------------------------------------------------------------

function notifyPhaseEnd({ finished, next }) {
  if (!Notification.isSupported()) return;
  const minutes = timer.phaseDuration(next) / 60000;
  const { title, body } = phaseEndMessage(finished, next, minutes, timer.running);

  const notification = new Notification({
    title,
    body,
    icon: path.join(ASSETS_DIR, 'icon.png'),
  });
  // Bildirime tıklanınca bekleyen aşamayı başlat ve zamanlayıcıyı göster.
  notification.on('click', () => {
    timer.start();
    showTimerWindow();
  });
  notification.show();
}

// ---------------------------------------------------------------------------
// Ayarlar ve istatistikler (JSON dosyaları)
// ---------------------------------------------------------------------------

async function loadData() {
  // userData: bu uygulamaya ait, yazma izni olan klasör.
  const dataDir = app.getPath('userData');
  settingsFile = path.join(dataDir, 'settings.json');
  statsFile = path.join(dataDir, 'stats.json');

  settings = normalizeSettings(await readJson(settingsFile, {}));
  stats = await readJson(statsFile, { days: {} });
}

async function saveSettings(input) {
  settings = normalizeSettings(input);
  await writeJson(settingsFile, settings);
  applySettings();
  return settings;
}

function applySettings() {
  timer.updateSettings(settings);
  windows.timer?.setAlwaysOnTop(settings.alwaysOnTop);

  // Açılışta başlatma yalnızca paketlenmiş uygulamada anlamlıdır. Geliştirme
  // sırasında bunu açarsak bilgisayar her açıldığında boş bir Electron başlar.
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.openAtLogin,
      args: ['--hidden'], // Windows: açılışta pencere göstermeden tepsiye otur
    });
  }
}

async function recordFocus() {
  stats = recordFocusSession(stats, settings.focusMinutes);
  await writeJson(statsFile, stats);
  broadcast('stats:changed');
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

// Mesaj gerçekten bizim sayfalarımızdan birinden mi geliyor? (Bölüm 6)
const TRUSTED_URLS = new Set(Object.values(PAGES).map((page) => pathToFileURL(page).href));
function isTrustedSender(event) {
  return TRUSTED_URLS.has(event.senderFrame?.url);
}

function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Güvenilmeyen gönderici: ${channel}`);
    return listener(...args);
  });
}

function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) listener(event, ...args);
  });
}

// İşleyicinin gönderebileceği komutlar. Listede olmayan her şey yok sayılır.
const TIMER_COMMANDS = {
  toggle: () => timer.toggle(),
  reset: () => timer.reset(),
  skip: () => timer.skip(),
};

function registerIpcHandlers() {
  handle('timer:get-state', () => timer.getState());
  handle('settings:get', () => ({
    settings,
    shortcut: { accelerator: TOGGLE_SHORTCUT, registered: shortcutRegistered },
  }));
  handle('settings:save', (input) => saveSettings(input));
  handle('stats:get', () => lastDays(stats, 7));

  on('timer:command', (_event, command) => {
    if (Object.hasOwn(TIMER_COMMANDS, command)) TIMER_COMMANDS[command]();
  });

  on('window:open', (_event, name) => {
    if (name === 'settings' || name === 'summary') openWindow(name);
  });

  // Mesajı gönderen pencereyi kapatır (mini pencere ise gizlenir).
  on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

// ---------------------------------------------------------------------------
// Uygulama yaşam döngüsü
// ---------------------------------------------------------------------------

// Biri uygulamayı ikinci kez açmaya çalıştı: yeni kopya kapandı,
// biz de kullanıcıya zaten açık olan zamanlayıcıyı gösteriyoruz.
app.on('second-instance', () => {
  if (app.isReady()) showTimerWindow();
});

app.whenReady().then(async () => {
  if (!gotLock) return; // Bu kopya kapanıyor; hiçbir şey kurma.
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath);
  }
  Menu.setApplicationMenu(null); // Pencerelerimizde uygulama menüsü yok

  await loadData();

  timer = new FocusTimer(settings);
  timer.on('change', (state) => {
    updateTray(state);
    broadcast('timer:state', state);
  });
  timer.on('tick', (state) => {
    updateTrayTime(state);
    broadcast('timer:state', state);
  });
  timer.on('phase-end', async (event) => {
    notifyPhaseEnd(event);
    if (event.finished === 'focus') await recordFocus();
  });

  // Zamanlayıcıyı saniyede dört kez yokla. Süreyi bu aralık değil,
  // saat belirler (timer.js'teki getRemainingMs açıklamasına bakın).
  setInterval(() => timer.tick(), 250);

  registerIpcHandlers();
  createTray();
  applySettings();

  shortcutRegistered = globalShortcut.register(TOGGLE_SHORTCUT, () => timer.toggle());
  if (!shortcutRegistered) {
    console.warn(`${TOGGLE_SHORTCUT} başka bir uygulama tarafından kullanılıyor.`);
  }

  // Açılışta başlatıldıysak pencere göstermeden tepside bekleriz.
  createTimerWindow({ show: !process.argv.includes('--hidden') });
});

// Son pencere kapansa da uygulama çalışmaya devam eder (tepside).
// Bu olayı dinleyip hiçbir şey yapmamak, varsayılan "çık" davranışını kapatır.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

// Genel kısayollar işletim sistemine kayıtlıdır; çıkarken geri veririz.
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
