// main.js — The main process of the Quick Note app.
//
// The main process opens the window, builds the menu, shows file dialogs and
// reads from and writes to disk. The renderer process cannot do any of this
// itself; it "asks" the main process through preload.cjs.

import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildWindowTitle, getDisplayName } from './document.js';
import { renderMarkdown } from './markdown.js';

// ES modules have no __dirname; we use import.meta.dirname instead.
const INDEX_HTML = path.join(import.meta.dirname, 'renderer', 'index.html');
const PRELOAD = path.join(import.meta.dirname, 'preload.cjs');

const FILE_FILTERS = [
  { name: 'Notes', extensions: ['md', 'markdown', 'txt'] },
  { name: 'All files', extensions: ['*'] },
];

// The app's single window and the state of the document open in it.
// We keep the file path in the main process: the renderer cannot say
// "write to this path", it can only say "save". This is a security measure.
let mainWindow = null;
const doc = {
  filePath: null, // null for a new note that has not been saved yet
  isDirty: false, // Are there unsaved changes?
  allowClose: false, // Has the user confirmed closing?
};

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 640,
    minHeight: 400,
    show: false, // We show it when the page is ready; no white flash.
    backgroundColor: '#f7f7f5',
    webPreferences: {
      preload: PRELOAD,
      // The three settings below are already the defaults. As in the secure
      // template from Chapter 6, we write them out so every reader sees them.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  updateTitle();
  mainWindow.loadFile(INDEX_HTML);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // We catch the close request. If there are unsaved changes we don't close
  // right away; we tell the renderer "they want to close, what shall we do?"
  mainWindow.on('close', (event) => {
    if (doc.isDirty && !doc.allowClose) {
      event.preventDefault();
      mainWindow.webContents.send('app:close-requested');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateTitle() {
  if (!mainWindow) return;
  mainWindow.setTitle(buildWindowTitle(doc.filePath, doc.isDirty));
  // On macOS this shows the dot in the close button; elsewhere it does nothing.
  mainWindow.setDocumentEdited(doc.isDirty);
}

function resetDocument(filePath = null) {
  doc.filePath = filePath;
  doc.isDirty = false;
  updateTitle();
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

// Forwards a menu command to the renderer. The renderer does the actual work,
// because the text in the editor lives there.
function sendMenuCommand(command) {
  mainWindow?.webContents.send('menu:command', command);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand('new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuCommand('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuCommand('save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Preview',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuCommand('toggle-preview'),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC: requests coming from the renderer
// ---------------------------------------------------------------------------

// Does the message really come from our page? (Chapter 6, "validating the sender")
function isTrustedSender(event) {
  return event.senderFrame?.url === pathToFileURL(INDEX_HTML).href;
}

// A version of ipcMain.handle that checks the sender. We register all of our
// request-response channels with it.
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Untrusted sender: ${channel}`);
    }
    return listener(...args);
  });
}

// The same check for one-way (send/on) messages.
function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) listener(...args);
  });
}

async function writeToDisk(filePath, content) {
  try {
    await writeFile(filePath, String(content), 'utf8');
    resetDocument(filePath);
    return { fileName: getDisplayName(filePath) };
  } catch (error) {
    dialog.showErrorBox('Could not save', `${filePath}\n\n${error.message}`);
    return null;
  }
}

async function saveAs(content) {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save note',
    defaultPath: doc.filePath ?? 'Untitled.md',
    filters: FILE_FILTERS,
  });
  if (canceled || !filePath) return null; // The user cancelled.
  return writeToDisk(filePath, content);
}

function registerIpcHandlers() {
  // New empty note
  handle('file:new', () => {
    resetDocument();
    return { fileName: getDisplayName(null) };
  });

  // Open dialog + reading from disk
  handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open note',
      properties: ['openFile'],
      filters: FILE_FILTERS,
    });
    if (canceled || filePaths.length === 0) return null;

    const [filePath] = filePaths;
    try {
      const content = await readFile(filePath, 'utf8');
      resetDocument(filePath);
      return { fileName: getDisplayName(filePath), content };
    } catch (error) {
      dialog.showErrorBox('Could not open file', `${filePath}\n\n${error.message}`);
      return null;
    }
  });

  // Save: write to the file's path if it has one, otherwise behave like "Save As".
  handle('file:save', (content) => {
    return doc.filePath ? writeToDisk(doc.filePath, content) : saveAs(content);
  });

  handle('file:save-as', (content) => saveAs(content));

  // Markdown -> HTML
  handle('markdown:render', (text) => renderMarkdown(String(text)));

  // The "Save changes?" question. Answer: 'save' | 'discard' | 'cancel'
  handle('dialog:confirm-unsaved', async () => {
    const choices = ['save', 'discard', 'cancel'];
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: `Do you want to save the changes to "${getDisplayName(doc.filePath)}"?`,
      detail: "Your changes will be lost if you don't save them.",
    });
    return choices[response];
  });

  // One-way messages: the renderer notifies, no reply is expected.
  on('document:set-dirty', (isDirty) => {
    doc.isDirty = Boolean(isDirty);
    updateTitle();
  });

  on('window:close', () => {
    doc.allowClose = true;
    mainWindow?.close();
  });
}

// ---------------------------------------------------------------------------
// Navigation security (Chapter 6)
// ---------------------------------------------------------------------------

// When a link in the preview is clicked we don't want the window to go to that
// site. Instead we open web addresses in the default browser.
app.on('web-contents-created', (_event, contents) => {
  const openSafely = (url) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
  };

  contents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openSafely(url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    openSafely(url);
    return { action: 'deny' };
  });
});

// ---------------------------------------------------------------------------
// App lifecycle (Chapter 3)
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  buildMenu();
  registerIpcHandlers();
  createWindow();

  // macOS: open a new window when the Dock icon is clicked and none is open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      doc.allowClose = false;
      resetDocument();
      createWindow();
    }
  });
});

// On systems other than macOS, the app quits when the last window closes.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
