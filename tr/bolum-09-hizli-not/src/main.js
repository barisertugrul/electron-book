// main.js — Hızlı Not uygulamasının ana süreci (main process).
//
// Ana süreç; pencereyi açar, menüyü kurar, dosya diyaloglarını gösterir ve
// diske okuma/yazma yapar. İşleyici süreç (renderer) bunların hiçbirini
// kendisi yapamaz; preload.cjs üzerinden ana sürece "rica eder".

import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildWindowTitle, getDisplayName } from './document.js';
import { renderMarkdown } from './markdown.js';

// ES modüllerinde __dirname yoktur; onun yerine import.meta.dirname kullanırız.
const INDEX_HTML = path.join(import.meta.dirname, 'renderer', 'index.html');
const PRELOAD = path.join(import.meta.dirname, 'preload.cjs');

const FILE_FILTERS = [
  { name: 'Notlar', extensions: ['md', 'markdown', 'txt'] },
  { name: 'Tüm dosyalar', extensions: ['*'] },
];

// Uygulamanın tek penceresi ve o pencerede açık olan belgenin durumu.
// Dosya yolunu ana süreçte tutuyoruz: işleyici "şu yola yaz" diyemez,
// sadece "kaydet" diyebilir. Bu, bir güvenlik önlemidir.
let mainWindow = null;
const doc = {
  filePath: null, // Henüz kaydedilmemiş yeni not için null
  isDirty: false, // Kaydedilmemiş değişiklik var mı?
  allowClose: false, // Kullanıcı kapatmayı onayladı mı?
};

// ---------------------------------------------------------------------------
// Pencere
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 640,
    minHeight: 400,
    show: false, // Sayfa hazır olunca göstereceğiz; beyaz yanıp sönme olmaz.
    backgroundColor: '#f7f7f5',
    webPreferences: {
      preload: PRELOAD,
      // Aşağıdaki üç ayar zaten varsayılan değerlerdir. Bölüm 6'daki güvenli
      // şablonda olduğu gibi, okuyan herkes görsün diye açıkça yazıyoruz.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  updateTitle();
  mainWindow.loadFile(INDEX_HTML);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Kapatma isteğini yakalarız. Kaydedilmemiş değişiklik varsa pencereyi
  // hemen kapatmaz, işleyiciye "kapanmak istiyorlar, ne yapalım?" deriz.
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
  // macOS'ta kapatma düğmesindeki noktayı gösterir; diğer sistemlerde etkisizdir.
  mainWindow.setDocumentEdited(doc.isDirty);
}

function resetDocument(filePath = null) {
  doc.filePath = filePath;
  doc.isDirty = false;
  updateTitle();
}

// ---------------------------------------------------------------------------
// Menü
// ---------------------------------------------------------------------------

// Menüden gelen komutu işleyiciye iletir. Asıl işi işleyici yapar, çünkü
// metin kutusundaki yazı oradadır.
function sendMenuCommand(command) {
  mainWindow?.webContents.send('menu:command', command);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Dosya',
      submenu: [
        { label: 'Yeni', accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand('new') },
        { label: 'Aç…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuCommand('open') },
        { type: 'separator' },
        { label: 'Kaydet', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        {
          label: 'Farklı Kaydet…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuCommand('save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Kapat' } : { role: 'quit', label: 'Çıkış' },
      ],
    },
    { role: 'editMenu', label: 'Düzen' },
    {
      label: 'Görünüm',
      submenu: [
        {
          label: 'Önizlemeyi Aç/Kapat',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuCommand('toggle-preview'),
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Gerçek Boyut' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC: işleyiciden gelen istekler
// ---------------------------------------------------------------------------

// Mesaj gerçekten bizim sayfamızdan mı geliyor? (Bölüm 6, "göndericiyi doğrulamak")
function isTrustedSender(event) {
  return event.senderFrame?.url === pathToFileURL(INDEX_HTML).href;
}

// ipcMain.handle'ın göndericiyi kontrol eden hali. Tüm istek-yanıt
// kanallarımızı bununla kaydederiz.
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Güvenilmeyen gönderici: ${channel}`);
    }
    return listener(...args);
  });
}

// Aynı kontrolün tek yönlü (send/on) mesajlar için olanı.
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
    dialog.showErrorBox('Kaydedilemedi', `${filePath}\n\n${error.message}`);
    return null;
  }
}

async function saveAs(content) {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Notu kaydet',
    defaultPath: doc.filePath ?? 'Adsız.md',
    filters: FILE_FILTERS,
  });
  if (canceled || !filePath) return null; // Kullanıcı vazgeçti.
  return writeToDisk(filePath, content);
}

function registerIpcHandlers() {
  // Yeni boş not
  handle('file:new', () => {
    resetDocument();
    return { fileName: getDisplayName(null) };
  });

  // Dosya aç diyaloğu + diskten okuma
  handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Not aç',
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
      dialog.showErrorBox('Dosya açılamadı', `${filePath}\n\n${error.message}`);
      return null;
    }
  });

  // Kaydet: dosyanın yolu varsa oraya yaz, yoksa "Farklı Kaydet" gibi davran.
  handle('file:save', (content) => {
    return doc.filePath ? writeToDisk(doc.filePath, content) : saveAs(content);
  });

  handle('file:save-as', (content) => saveAs(content));

  // Markdown -> HTML
  handle('markdown:render', (text) => renderMarkdown(String(text)));

  // "Değişiklikler kaydedilsin mi?" sorusu. Cevap: 'save' | 'discard' | 'cancel'
  handle('dialog:confirm-unsaved', async () => {
    const choices = ['save', 'discard', 'cancel'];
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Kaydet', 'Kaydetme', 'Vazgeç'],
      defaultId: 0,
      cancelId: 2,
      title: 'Kaydedilmemiş değişiklikler',
      message: `"${getDisplayName(doc.filePath)}" notundaki değişiklikler kaydedilsin mi?`,
      detail: 'Kaydetmezseniz değişiklikleriniz kaybolur.',
    });
    return choices[response];
  });

  // Tek yönlü mesajlar: işleyici bildirir, cevap beklemez.
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
// Gezinme güvenliği (Bölüm 6)
// ---------------------------------------------------------------------------

// Önizlemedeki bir bağlantıya tıklanınca pencerenin o siteye gitmesini
// istemeyiz. Bunun yerine güvenli (https) adresleri varsayılan tarayıcıda açarız.
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
// Uygulama yaşam döngüsü (Bölüm 3)
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  buildMenu();
  registerIpcHandlers();
  createWindow();

  // macOS: Dock simgesine tıklanınca ve açık pencere yoksa yenisini aç.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      doc.allowClose = false;
      resetDocument();
      createWindow();
    }
  });
});

// macOS dışındaki sistemlerde son pencere kapanınca uygulama da kapanır.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
