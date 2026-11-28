// main.js — Budget Tracker's main process.
//
// Opens the database, registers the IPC channels and shows the window.
// ONLY the main process touches the database; the React UI asks for data
// through the preload bridge (the secure template from Chapter 6).

import { app, Menu } from 'electron';
import path from 'node:path';

import { LOCALE } from '../shared/labels.js';
import { createBudgetStore } from './budget-store.js';
import { openDatabase } from './database.js';
import { registerIpcHandlers } from './ipc.js';
import { createWindow, loadPage } from './window.js';

let mainWindow = null;

// Parts that Chromium draws, like the date box (input type="date"), should
// appear in the book's language: 11/28/2026. This must be set before the app is ready.
app.commandLine.appendSwitch('lang', LOCALE);

app.whenReady().then(() => {
  // The database file lives in the user data folder; on Windows that is
  // C:\Users\<name>\AppData\Roaming\Budget Tracker\budget.sqlite
  const db = openDatabase(path.join(app.getPath('userData'), 'budget.sqlite'));
  const store = createBudgetStore(db);

  Menu.setApplicationMenu(null);
  registerIpcHandlers(store, () => mainWindow);

  mainWindow = createWindow();
  loadPage(mainWindow);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Close the database properly when the app quits.
  app.on('will-quit', () => db.close());
});

app.on('window-all-closed', () => {
  app.quit();
});
