// window.js — Creating windows and loading the page.
//
// Both the main window and the hidden window opened for the PDF report are
// created with the settings here, so the security settings live in one place.

import { BrowserWindow, app, nativeTheme } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { APP_NAME } from '../shared/labels.js';

// The Vite plugin fills in these two values at build time. During development
// (npm start) the page comes from Vite's server; in the packaged app, from
// the index.html file on disk.
// (__dirname is the .vite/build folder where the built file lives.)
const DEV_SERVER_URL = MAIN_WINDOW_VITE_DEV_SERVER_URL;
const PAGE_FILE = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
const PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON = path.join(app.getAppPath(), 'assets', 'icon.png');

// The address of the UI. Also used in IPC to check "did our own page send
// this request?"
export const PAGE_URL = DEV_SERVER_URL ? new URL(DEV_SERVER_URL).href : pathToFileURL(PAGE_FILE).href;

// Loads the page. route is the part of the address after the # sign:
// "report/2026-11" -> the report page (opened in a hidden window for the PDF).
export function loadPage(window, route = '') {
  return DEV_SERVER_URL
    ? window.loadURL(`${DEV_SERVER_URL}#/${route}`)
    : window.loadFile(PAGE_FILE, { hash: `/${route}` });
}

// The main window and the report window use the same security settings.
export function createWindow(options = {}) {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    icon: ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1e22' : '#f6f6f4',
    webPreferences: { preload: PRELOAD }, // contextIsolation and sandbox are on by default
    ...options,
  });

  // The page cannot go to another address or open new windows. This app has
  // no external links; if it did, we would open them in the browser with
  // shell.openExternal.
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return window;
}
