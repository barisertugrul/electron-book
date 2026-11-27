// renderer.js — Hızlı Not'un arayüz kodu (işleyici süreç).
//
// Bu dosya sıradan bir web sayfası betiğidir: Node.js yoktur, dosya sistemine
// erişemez. Dış dünyayla tek bağlantısı preload.cjs'in açtığı window.quickNote
// nesnesidir.

const api = window.quickNote;

// Sayfadaki öğeler (Köşe Taşı 7: DOM seçimi)
const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');
const previewPane = document.querySelector('#preview-pane');
const workspace = document.querySelector('#workspace');
const fileNameLabel = document.querySelector('#file-name');
const dirtyBadge = document.querySelector('#dirty-badge');
const stats = document.querySelector('#stats');
const previewButton = document.querySelector('#btn-preview');

let isDirty = false;

// ---------------------------------------------------------------------------
// Durum göstergeleri
// ---------------------------------------------------------------------------

function setDirty(value) {
  isDirty = value;
  dirtyBadge.hidden = !value;
  api.setDirty(value); // Ana süreç pencere başlığını günceller.
}

function setFileName(name) {
  fileNameLabel.textContent = name;
}

function updateStats() {
  const text = editor.value;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  stats.textContent = `${words} kelime · ${text.length} karakter`;
}

// ---------------------------------------------------------------------------
// Önizleme
// ---------------------------------------------------------------------------

async function renderPreview() {
  // HTML'i ana süreç üretir. Ham HTML ve tehlikeli bağlantılar orada
  // temizlendiği için sonucu innerHTML ile koymak güvenlidir (Bölüm 6).
  preview.innerHTML = await api.renderMarkdown(editor.value);
}

// Her tuşta değil, yazmaya 150 ms ara verilince önizlemeyi yenile.
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
}

function togglePreview() {
  const visible = previewPane.hidden;
  previewPane.hidden = !visible;
  workspace.classList.toggle('single', !visible);
  previewButton.setAttribute('aria-pressed', String(visible));
  if (visible) renderPreview();
}

// ---------------------------------------------------------------------------
// Dosya komutları
// ---------------------------------------------------------------------------

function showDocument(fileName, content) {
  editor.value = content;
  setFileName(fileName);
  setDirty(false);
  updateStats();
  renderPreview();
  editor.focus();
}

// Kaydedilmemiş değişiklik varsa kullanıcıya sorar.
// true dönerse işleme devam edilebilir (yeni, aç, kapat).
async function continueIfSafe() {
  if (!isDirty) return true;

  const choice = await api.confirmUnsaved();
  if (choice === 'cancel') return false;
  if (choice === 'save') return save();
  return true; // 'discard': kaydetmeden devam
}

async function newFile() {
  if (!(await continueIfSafe())) return;
  const { fileName } = await api.newFile();
  showDocument(fileName, '');
}

async function openFile() {
  if (!(await continueIfSafe())) return;
  const result = await api.openFile();
  if (result) showDocument(result.fileName, result.content);
}

// Kaydedildiyse true, kullanıcı vazgeçtiyse veya hata olduysa false döner.
async function save({ askForPath = false } = {}) {
  const content = editor.value;
  const result = askForPath ? await api.saveFileAs(content) : await api.saveFile(content);
  if (!result) return false;

  setFileName(result.fileName);
  // Kaydederken kullanıcı yazmaya devam ettiyse değişiklik hâlâ vardır.
  setDirty(editor.value !== content);
  return true;
}

const commands = {
  new: newFile,
  open: openFile,
  save: () => save(),
  'save-as': () => save({ askForPath: true }),
  'toggle-preview': togglePreview,
};

// ---------------------------------------------------------------------------
// Olaylar (Köşe Taşı 3)
// ---------------------------------------------------------------------------

editor.addEventListener('input', () => {
  // Sadece ilk değişiklikte bildir; her tuşta ana süreci rahatsız etmeyelim.
  if (!isDirty) setDirty(true);
  updateStats();
  schedulePreview();
});

// Tab tuşu odaktan çıkmak yerine iki boşluk eklesin.
editor.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input'));
});

document.querySelector('#btn-new').addEventListener('click', commands.new);
document.querySelector('#btn-open').addEventListener('click', commands.open);
document.querySelector('#btn-save').addEventListener('click', commands.save);
previewButton.addEventListener('click', commands['toggle-preview']);

// Menüden gelen komutlar
api.onMenuCommand((command) => commands[command]?.());

// Pencere kapatılmak istendiğinde (yalnızca kaydedilmemiş değişiklik varsa gelir)
api.onCloseRequested(async () => {
  if (await continueIfSafe()) api.closeWindow();
});

// Başlangıç
updateStats();
renderPreview();
editor.focus();
