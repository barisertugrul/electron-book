// Chapter 1 — A first look at Electron
// This file runs in the MAIN PROCESS: Node.js is available here.
// We will go through this code line by line in Chapter 3.

import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 720,
    height: 480,
    title: 'A First Look at Electron',
  });

  // A web page opens inside the window. This page runs in the RENDERER
  // PROCESS: it has Chromium, but no Node.js.
  mainWindow.loadFile(path.join(import.meta.dirname, 'index.html'));
}

// Wait until Electron is ready, then open our window.
app.whenReady().then(() => {
  // These lines are printed to the terminal by the main process.
  console.log('Electron version :', process.versions.electron);
  console.log('Chromium version :', process.versions.chrome);
  console.log('Node.js version  :', process.versions.node);

  createWindow();
});

// Quit when all windows are closed (we will handle the macOS difference in Chapter 3).
app.on('window-all-closed', () => {
  app.quit();
});
