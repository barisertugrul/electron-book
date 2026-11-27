// renderer.js — The user interface code of Quick Note (renderer process).
//
// This file is an ordinary web page script: it has no Node.js and cannot
// access the file system. Its only link to the outside world is the
// window.quickNote object exposed by preload.cjs.

const api = window.quickNote;

// Elements on the page (JS Cornerstone 7: selecting DOM elements)
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
// Status indicators
// ---------------------------------------------------------------------------

function setDirty(value) {
  isDirty = value;
  dirtyBadge.hidden = !value;
  api.setDirty(value); // The main process updates the window title.
}

function setFileName(name) {
  fileNameLabel.textContent = name;
}

function updateStats() {
  const text = editor.value;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  stats.textContent = `${words} words · ${text.length} characters`;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

async function renderPreview() {
  // The main process produces the HTML. Raw HTML and dangerous links are
  // cleaned there, so putting the result in innerHTML is safe (Chapter 6).
  preview.innerHTML = await api.renderMarkdown(editor.value);
}

// Refresh the preview after a 150 ms pause in typing, not on every key.
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
// File commands
// ---------------------------------------------------------------------------

function showDocument(fileName, content) {
  editor.value = content;
  setFileName(fileName);
  setDirty(false);
  updateStats();
  renderPreview();
  editor.focus();
}

// Asks the user if there are unsaved changes.
// If it returns true, the action can continue (new, open, close).
async function continueIfSafe() {
  if (!isDirty) return true;

  const choice = await api.confirmUnsaved();
  if (choice === 'cancel') return false;
  if (choice === 'save') return save();
  return true; // 'discard': continue without saving
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

// Returns true if saved, false if the user cancelled or an error occurred.
async function save({ askForPath = false } = {}) {
  const content = editor.value;
  const result = askForPath ? await api.saveFileAs(content) : await api.saveFile(content);
  if (!result) return false;

  setFileName(result.fileName);
  // If the user kept typing while saving, there are still changes.
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
// Events (JS Cornerstone 3)
// ---------------------------------------------------------------------------

editor.addEventListener('input', () => {
  // Notify only on the first change; don't bother the main process on every key.
  if (!isDirty) setDirty(true);
  updateStats();
  schedulePreview();
});

// Make the Tab key insert two spaces instead of moving the focus.
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

// Commands coming from the menu
api.onMenuCommand((command) => commands[command]?.());

// When the window is about to close (only sent if there are unsaved changes)
api.onCloseRequested(async () => {
  if (await continueIfSafe()) api.closeWindow();
});

// Startup
updateStats();
renderPreview();
editor.focus();
