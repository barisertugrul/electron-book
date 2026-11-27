// main.js — The main process of Focus Timer.
//
// Unlike Quick Note, this app keeps working while its window is closed:
// the timer runs in the main process and the app waits in the system tray
// (next to the clock). The windows exist only to show the timer and to
// change the settings.

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
// Single instance lock: don't let the app open twice
// ---------------------------------------------------------------------------

// Two timers running at once would mean two tray icons and two notifications.
// If we can't get the lock, another copy is already running: we quit at once.
// That copy receives the 'second-instance' event (we listen for it below).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---------------------------------------------------------------------------
// File paths and app state
// ---------------------------------------------------------------------------

const RENDERER_DIR = path.join(import.meta.dirname, 'renderer');
const PRELOAD = path.join(import.meta.dirname, 'preload.cjs');
const ASSETS_DIR = path.join(import.meta.dirname, '..', 'assets');

const PAGES = {
  timer: path.join(RENDERER_DIR, 'timer.html'),
  settings: path.join(RENDERER_DIR, 'settings.html'),
  summary: path.join(RENDERER_DIR, 'summary.html'),
};

// Needed on Windows so notifications show the right app name.
const APP_ID = 'com.ertyazilim.focus-timer';

// Start/pause from anywhere (works even while the app is in the background).
const TOGGLE_SHORTCUT = 'CommandOrControl+Alt+P';

let settingsFile; // Known once the app is ready (userData folder)
let statsFile;
let settings;
let stats;
let timer;
let tray = null;
let shortcutRegistered = false;
let isQuitting = false; // When true, windows really close instead of hiding
let lastShownTime = ''; // Updates the tray tooltip only once per second

const windows = { timer: null, settings: null, summary: null };

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

// The background shown until the page loads; it matches the theme so there
// is no white or black flash.
function windowBackground() {
  return nativeTheme.shouldUseDarkColors ? '#1f2125' : '#ffffff';
}

const webPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
};

// The mini timer: frameless, small, optionally always on top.
function createTimerWindow({ show = true } = {}) {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 300;
  const height = 210;

  const win = new BrowserWindow({
    width,
    height,
    // Place it in the bottom-right corner, just above the taskbar.
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
    frame: false, // No title bar or border; CSS provides the drag area
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true, // Don't take up taskbar space; the tray icon is enough
    alwaysOnTop: settings.alwaysOnTop,
    show: false,
    title: APP_NAME,
    backgroundColor: windowBackground(),
    webPreferences,
  });

  win.loadFile(PAGES.timer);
  if (show) win.once('ready-to-show', () => win.show());

  // The close button doesn't destroy the window, it hides it. The timer keeps
  // running in the main process. It only really closes when "Quit" is chosen.
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

// Settings and daily summary: ordinary windows. If one is open we bring it
// to the front instead of opening another.
function openWindow(name) {
  if (windows[name]) {
    windows[name].show();
    windows[name].focus();
    return;
  }
  const win = new BrowserWindow({
    width: name === 'settings' ? 420 : 480,
    height: name === 'settings' ? 520 : 440,
    useContentSize: true, // The sizes are for the page area, without the frame
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

// Sends the same message to all of our open windows.
function broadcast(channel, data) {
  for (const win of Object.values(windows)) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  }
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------

// A red icon during focus, a green one during breaks. The @2x version of the
// file is used automatically on high-resolution screens.
const trayIcons = {};
function trayIcon(phase) {
  const name = phase === 'focus' ? 'tray-focus.png' : 'tray-break.png';
  trayIcons[name] ??= nativeImage.createFromPath(path.join(ASSETS_DIR, name));
  return trayIcons[name];
}

function createTray() {
  tray = new Tray(trayIcon(timer.phase));
  // On Windows and Linux, clicking the icon shows/hides the mini window.
  tray.on('click', toggleTimerWindow);
  updateTray(timer.getState());
}

// Rebuilds the tray menu for the current state (Start ↔ Pause and so on).
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

// The tooltip shown while the mouse is over the icon: "Focus — 24:13".
// On macOS the time also appears next to the icon in the menu bar.
function updateTrayTime(state, force = false) {
  const time = formatTime(state.remainingMs);
  if (!force && time === lastShownTime) return;
  lastShownTime = time;
  tray.setToolTip(`${APP_NAME}\n${PHASE_LABELS[state.phase]} — ${time}`);
  if (process.platform === 'darwin') tray.setTitle(time);
}

// ---------------------------------------------------------------------------
// Notifications
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
  // Clicking the notification starts the waiting phase and shows the timer.
  notification.on('click', () => {
    timer.start();
    showTimerWindow();
  });
  notification.show();
}

// ---------------------------------------------------------------------------
// Settings and statistics (JSON files)
// ---------------------------------------------------------------------------

async function loadData() {
  // userData: a folder that belongs to this app and that we may write to.
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

  // Opening at login only makes sense for the packaged app. If we turned it
  // on during development, an empty Electron would start with every boot.
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.openAtLogin,
      args: ['--hidden'], // Windows: start in the tray without showing a window
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

// Does the message really come from one of our pages? (Chapter 6)
const TRUSTED_URLS = new Set(Object.values(PAGES).map((page) => pathToFileURL(page).href));
function isTrustedSender(event) {
  return TRUSTED_URLS.has(event.senderFrame?.url);
}

function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Untrusted sender: ${channel}`);
    return listener(...args);
  });
}

function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) listener(event, ...args);
  });
}

// The commands the renderer may send. Anything not in this list is ignored.
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

  // Closes the window that sent the message (the mini window hides instead).
  on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Someone tried to open the app a second time: the new copy has quit,
// and we show the user the timer that is already open.
app.on('second-instance', () => {
  if (app.isReady()) showTimerWindow();
});

app.whenReady().then(async () => {
  if (!gotLock) return; // This copy is quitting; set nothing up.
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath);
  }
  Menu.setApplicationMenu(null); // Our windows have no application menu

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

  // Check the timer four times a second. The clock decides the time, not
  // this interval (see the getRemainingMs comment in timer.js).
  setInterval(() => timer.tick(), 250);

  registerIpcHandlers();
  createTray();
  applySettings();

  shortcutRegistered = globalShortcut.register(TOGGLE_SHORTCUT, () => timer.toggle());
  if (!shortcutRegistered) {
    console.warn(`${TOGGLE_SHORTCUT} is already used by another application.`);
  }

  // If we were started at login, wait in the tray without showing a window.
  createTimerWindow({ show: !process.argv.includes('--hidden') });
});

// The app keeps running (in the tray) even when the last window closes.
// Listening for this event and doing nothing turns off the default "quit".
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

// Global shortcuts are registered with the operating system; we give them
// back when quitting.
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
