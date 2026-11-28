// app.js — The code of the Batch Photos window.
//
// The main process owns the photo list; after each change we get the
// current list and draw it. The new names, however, we work out here with
// the same plan.js file the main process uses: the name you see in the
// preview is exactly the name that will be written to disk.

import { GROUPING_LABELS, LOCALE, NAME_TOKENS } from '../shared/labels.js';
import {
  buildName,
  DEFAULT_RULES,
  formatBytes,
  MAX_SIZES,
  planOutputs,
  summarize,
} from '../shared/plan.js';

const api = window.photoTool;
const $ = (selector) => document.querySelector(selector);

const state = {
  photos: [],
  rules: { ...DEFAULT_RULES },
  outputDir: null,
  busy: false, // Is a scan or a job running?
};

const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------------------
// Rules panel
// ---------------------------------------------------------------------------

function setupRules() {
  // Small buttons that add a word to the template: {year}, {month}...
  const tokenButtons = Object.values(NAME_TOKENS).map((word) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'token';
    button.textContent = `{${word}}`;
    button.addEventListener('click', () => insertToken(`{${word}}`));
    return button;
  });
  $('#tokens').replaceChildren(...tokenButtons);

  $('#grouping').replaceChildren(
    ...Object.entries(GROUPING_LABELS).map(([value, label]) => new Option(label, value)),
  );
  $('#max-size').replaceChildren(
    ...MAX_SIZES.map((size) => new Option(size === 0 ? 'Keep original' : `${size} pixels`, size)),
  );

  $('#template').value = state.rules.template;
  $('#grouping').value = state.rules.grouping;
  $('#max-size').value = state.rules.maxSize;
  $('#quality').value = state.rules.quality;
  $('#keep-metadata').checked = state.rules.keepMetadata;

  // Whenever a rule changes, work out the plan again.
  for (const id of ['#template', '#grouping', '#max-size', '#quality', '#keep-metadata']) {
    $(id).addEventListener('input', readRules);
  }
}

function readRules() {
  state.rules = {
    template: $('#template').value,
    grouping: $('#grouping').value,
    maxSize: Number($('#max-size').value),
    quality: Number($('#quality').value),
    keepMetadata: $('#keep-metadata').checked,
  };
  render();
}

// Inserts a word where the cursor is.
function insertToken(token) {
  const input = $('#template');
  input.setRangeText(token, input.selectionStart, input.selectionEnd, 'end');
  input.focus();
  readRules();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function render() {
  const plan = planOutputs(state.photos, state.rules);
  const hasPhotos = plan.length > 0;

  $('#empty').hidden = hasPhotos;
  $('#list').hidden = !hasPhotos;
  $('#quality-value').textContent = state.rules.quality;
  $('#example').textContent = exampleName();
  $('#output-dir').textContent = state.outputDir ? shortPath(state.outputDir) : 'Not chosen';
  $('#output-dir').title = state.outputDir ?? '';
  $('#btn-start').disabled = state.busy || !hasPhotos || !state.outputDir;

  if (!state.busy) $('#status-text').textContent = statusText(hasPhotos);

  if (hasPhotos) {
    const { count, totalBytes, withExifDate } = summarize(state.photos);
    $('#summary').textContent =
      `${count} photos · ${formatBytes(totalBytes)} · ${withExifDate} with a date taken`;
    $('#rows').replaceChildren(...plan.map(createRow));
  }
}

// "C:\Users\amy\Pictures\Holiday" -> "…\Pictures\Holiday". The full path
// appears in a tooltip when the mouse is over it.
function shortPath(fullPath) {
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return fullPath;
  const separator = fullPath.includes('\\') ? '\\' : '/';
  return `…${separator}${parts.slice(-2).join(separator)}`;
}

function statusText(hasPhotos) {
  if (!hasPhotos) return 'Add photos to get started.';
  if (!state.outputDir) return 'Choose the folder to save the photos to.';
  return 'Ready. Your original files stay unchanged; new copies are created.';
}

// How the template looks with today's date.
function exampleName() {
  const sample = { name: 'IMG_2041.jpg', takenAt: new Date().toISOString() };
  return `${buildName(state.rules.template, sample, 1)}.jpg`;
}

function createRow({ source, target, photo }) {
  const row = document.createElement('tr');

  const thumbCell = row.insertCell();
  const image = document.createElement('img');
  image.className = 'thumb';
  image.src = photo.thumbnail; // The data: URL made by the worker
  image.alt = '';
  thumbCell.append(image);

  const fileCell = row.insertCell();
  fileCell.append(
    textElement('div', photo.name, 'file-name'),
    textElement('div', `${photo.width} × ${photo.height} · ${formatBytes(photo.size)}`, 'muted'),
  );

  const dateCell = row.insertCell();
  dateCell.append(textElement('div', dateFormat.format(new Date(photo.takenAt))));
  if (photo.dateSource === 'file') {
    // No EXIF: the date comes from the file's modification date.
    dateCell.append(textElement('span', 'file date', 'badge'));
  }

  const targetCell = row.insertCell();
  targetCell.className = 'target';
  const slash = target.lastIndexOf('/');
  if (slash > 0) targetCell.append(textElement('span', target.slice(0, slash + 1), 'muted'));
  targetCell.append(textElement('span', target.slice(slash + 1)));

  const removeCell = row.insertCell();
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-button';
  remove.textContent = '×';
  remove.title = 'Remove from the list';
  remove.disabled = state.busy;
  remove.addEventListener('click', async () => {
    state.photos = await api.removePhoto(source);
    render();
  });
  removeCell.append(remove);

  return row;
}

// We use textContent: whatever the file name is, it is never treated as
// HTML (Cornerstone 6).
function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// ---------------------------------------------------------------------------
// Progress and the busy state
// ---------------------------------------------------------------------------

function setBusy(busy) {
  state.busy = busy;
  $('#btn-cancel').hidden = !busy;
  $('#btn-cancel').disabled = false;
  $('#progress').hidden = !busy;
  $('#progress').value = 0;
  for (const button of document.querySelectorAll('.rules button, .list-header button, #btn-pick-empty')) {
    button.disabled = busy;
  }
  render();
}

function showProgress(label, { done, total, current }) {
  $('#progress').value = total ? done / total : 0;
  $('#status-text').textContent = current
    ? `${label} ${done} / ${total} · ${current}`
    : `${label} ${done} / ${total}`;
}

// ---------------------------------------------------------------------------
// Adding photos: drag and drop and "Choose files"
// ---------------------------------------------------------------------------

async function addPaths(paths) {
  if (paths.length === 0 || state.busy) return;
  setBusy(true);
  $('#status-text').textContent = 'Scanning…';
  const result = await api.scan(paths);
  setBusy(false);

  if (result.error) {
    $('#status-text').textContent = result.error;
    return;
  }
  state.photos = result.photos;
  render();
  if (result.errors.length > 0) {
    $('#status-text').textContent = `${result.errors.length} files could not be read: ${result.errors
      .map((error) => error.name)
      .join(', ')}`;
  }
}

function setupDragAndDrop() {
  const target = $('#drop-target');

  // A file dropped anywhere on the page would be opened by the browser.
  // We prevent that; only the right-hand side accepts drops.
  for (const type of ['dragover', 'drop']) {
    document.addEventListener(type, (event) => event.preventDefault());
  }

  target.addEventListener('dragenter', () => target.classList.add('dragging'));
  target.addEventListener('dragleave', (event) => {
    // Moving over child elements also fires dragleave; did we really leave?
    if (!target.contains(event.relatedTarget)) target.classList.remove('dragging');
  });
  target.addEventListener('drop', (event) => {
    target.classList.remove('dragging');
    const paths = [...event.dataTransfer.files].map((file) => api.pathForFile(file));
    addPaths(paths.filter(Boolean));
  });
}

// ---------------------------------------------------------------------------
// Processing and the result
// ---------------------------------------------------------------------------

async function start() {
  setBusy(true);
  $('#status-text').textContent = 'Starting…';
  const result = await api.process(state.rules);
  setBusy(false);

  if (result.error) {
    $('#status-text').textContent = result.error;
    return;
  }
  showResult(result);
}

function showResult(result) {
  $('#result-title').textContent = result.cancelled ? 'Job cancelled' : 'Done';
  $('#result-processed').textContent = `${result.processed} photos`;
  $('#result-failed').textContent = String(result.failed.length);
  $('#result-size').textContent = `${formatBytes(result.bytesIn)} → ${formatBytes(result.bytesOut)}`;
  $('#result-time').textContent = `${(result.elapsedMs / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} s`;
  $('#result-errors').replaceChildren(
    ...result.failed.map((item) => textElement('li', `${item.name}: ${item.message}`)),
  );
  $('#result').showModal();
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function pickPhotos() {
  addPaths(await api.pickPhotos());
}

$('#btn-pick-empty').addEventListener('click', pickPhotos);
$('#btn-add').addEventListener('click', pickPhotos);
$('#btn-clear').addEventListener('click', async () => {
  state.photos = await api.clearPhotos();
  render();
});
$('#btn-output').addEventListener('click', async () => {
  state.outputDir = await api.pickOutput();
  render();
});
$('#btn-start').addEventListener('click', start);
$('#btn-cancel').addEventListener('click', () => {
  api.cancel();
  $('#btn-cancel').disabled = true; // Pressing once is enough
});
$('#btn-open-output').addEventListener('click', () => api.openOutput());
$('#btn-close-result').addEventListener('click', () => $('#result').close());

api.onScanProgress((progress) => showProgress('Scanning', progress));
api.onProcessProgress((progress) => showProgress('Processing', progress));

setupRules();
setupDragAndDrop();

// The list lives in the main process: it survives a page reload.
const saved = await api.getState();
state.photos = saved.photos;
state.outputDir = saved.outputDir;
render();
