// app.js — Toplu Fotoğraf penceresinin kodu.
//
// Fotoğraf listesinin asıl sahibi ana süreç; biz her değişiklikten sonra
// güncel listeyi alıp ekrana çiziyoruz. Yeni adları ise burada, ana süreçle
// aynı plan.js dosyasıyla hesaplıyoruz: önizlemede gördüğünüz ad, diske
// yazılacak adın ta kendisi.

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
  busy: false, // Tarama ya da işleme sürüyor mu?
};

const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------------------
// Kurallar paneli
// ---------------------------------------------------------------------------

function setupRules() {
  // Şablona kelime ekleyen küçük düğmeler: {yıl}, {ay}...
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
    ...MAX_SIZES.map((size) => new Option(size === 0 ? 'Değiştirme' : `${size} piksel`, size)),
  );

  $('#template').value = state.rules.template;
  $('#grouping').value = state.rules.grouping;
  $('#max-size').value = state.rules.maxSize;
  $('#quality').value = state.rules.quality;
  $('#keep-metadata').checked = state.rules.keepMetadata;

  // Herhangi bir kural değişince planı yeniden hesapla.
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

// İmlecin bulunduğu yere kelime ekler.
function insertToken(token) {
  const input = $('#template');
  input.setRangeText(token, input.selectionStart, input.selectionEnd, 'end');
  input.focus();
  readRules();
}

// ---------------------------------------------------------------------------
// Çizim
// ---------------------------------------------------------------------------

function render() {
  const plan = planOutputs(state.photos, state.rules);
  const hasPhotos = plan.length > 0;

  $('#empty').hidden = hasPhotos;
  $('#list').hidden = !hasPhotos;
  $('#quality-value').textContent = state.rules.quality;
  $('#example').textContent = exampleName();
  $('#output-dir').textContent = state.outputDir ? shortPath(state.outputDir) : 'Seçilmedi';
  $('#output-dir').title = state.outputDir ?? '';
  $('#btn-start').disabled = state.busy || !hasPhotos || !state.outputDir;

  if (!state.busy) $('#status-text').textContent = statusText(hasPhotos);

  if (hasPhotos) {
    const { count, totalBytes, withExifDate } = summarize(state.photos);
    $('#summary').textContent =
      `${count} fotoğraf · ${formatBytes(totalBytes)} · ${withExifDate} tanesinde çekim tarihi var`;
    $('#rows').replaceChildren(...plan.map(createRow));
  }
}

// "C:\Users\ayse\Resimler\Tatil" -> "…\Resimler\Tatil". Tam yol, fare üstüne
// gelince ipucunda görünür.
function shortPath(fullPath) {
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return fullPath;
  const separator = fullPath.includes('\\') ? '\\' : '/';
  return `…${separator}${parts.slice(-2).join(separator)}`;
}

function statusText(hasPhotos) {
  if (!hasPhotos) return 'Başlamak için fotoğraf ekleyin.';
  if (!state.outputDir) return 'Fotoğrafların kaydedileceği klasörü seçin.';
  return 'Hazır. Asıl dosyalarınız değişmez; yeni kopyalar oluşturulur.';
}

// Şablonun bugünün tarihiyle nasıl görüneceği.
function exampleName() {
  const sample = { name: 'IMG_2041.jpg', takenAt: new Date().toISOString() };
  return `${buildName(state.rules.template, sample, 1)}.jpg`;
}

function createRow({ source, target, photo }) {
  const row = document.createElement('tr');

  const thumbCell = row.insertCell();
  const image = document.createElement('img');
  image.className = 'thumb';
  image.src = photo.thumbnail; // İşçinin ürettiği data: adresi
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
    // EXIF yok: tarih dosyanın değiştirilme tarihinden geliyor.
    dateCell.append(textElement('span', 'dosya tarihi', 'badge'));
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
  remove.title = 'Listeden çıkar';
  remove.disabled = state.busy;
  remove.addEventListener('click', async () => {
    state.photos = await api.removePhoto(source);
    render();
  });
  removeCell.append(remove);

  return row;
}

// textContent kullanıyoruz: dosya adı ne olursa olsun HTML olarak
// yorumlanmaz (Köşe Taşı 6).
function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// ---------------------------------------------------------------------------
// İlerleme ve meşgul durumu
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
// Fotoğraf ekleme: sürükle-bırak ve "Dosya seç"
// ---------------------------------------------------------------------------

async function addPaths(paths) {
  if (paths.length === 0 || state.busy) return;
  setBusy(true);
  $('#status-text').textContent = 'Taranıyor…';
  const result = await api.scan(paths);
  setBusy(false);

  if (result.error) {
    $('#status-text').textContent = result.error;
    return;
  }
  state.photos = result.photos;
  render();
  if (result.errors.length > 0) {
    $('#status-text').textContent = `${result.errors.length} dosya okunamadı: ${result.errors
      .map((error) => error.name)
      .join(', ')}`;
  }
}

function setupDragAndDrop() {
  const target = $('#drop-target');

  // Sayfanın herhangi bir yerine bırakılan dosyayı tarayıcı açmaya çalışır.
  // Bunu engelliyoruz; bırakmayı yalnızca sağ taraf kabul eder.
  for (const type of ['dragover', 'drop']) {
    document.addEventListener(type, (event) => event.preventDefault());
  }

  target.addEventListener('dragenter', () => target.classList.add('dragging'));
  target.addEventListener('dragleave', (event) => {
    // Alt öğelerin üstüne gelmek de dragleave üretir; gerçekten çıktık mı?
    if (!target.contains(event.relatedTarget)) target.classList.remove('dragging');
  });
  target.addEventListener('drop', (event) => {
    target.classList.remove('dragging');
    const paths = [...event.dataTransfer.files].map((file) => api.pathForFile(file));
    addPaths(paths.filter(Boolean));
  });
}

// ---------------------------------------------------------------------------
// İşleme ve sonuç
// ---------------------------------------------------------------------------

async function start() {
  setBusy(true);
  $('#status-text').textContent = 'Başlıyor…';
  const result = await api.process(state.rules);
  setBusy(false);

  if (result.error) {
    $('#status-text').textContent = result.error;
    return;
  }
  showResult(result);
}

function showResult(result) {
  $('#result-title').textContent = result.cancelled ? 'İş yarıda kesildi' : 'Bitti';
  $('#result-processed').textContent = `${result.processed} fotoğraf`;
  $('#result-failed').textContent = String(result.failed.length);
  $('#result-size').textContent = `${formatBytes(result.bytesIn)} → ${formatBytes(result.bytesOut)}`;
  $('#result-time').textContent = `${(result.elapsedMs / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} sn`;
  $('#result-errors').replaceChildren(
    ...result.failed.map((item) => textElement('li', `${item.name}: ${item.message}`)),
  );
  $('#result').showModal();
}

// ---------------------------------------------------------------------------
// Başlangıç
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
  $('#btn-cancel').disabled = true; // Bir kez basmak yeter
});
$('#btn-open-output').addEventListener('click', () => api.openOutput());
$('#btn-close-result').addEventListener('click', () => $('#result').close());

api.onScanProgress((progress) => showProgress('Taranıyor', progress));
api.onProcessProgress((progress) => showProgress('İşleniyor', progress));

setupRules();
setupDragAndDrop();

// Liste ana süreçte duruyor: sayfa yenilense bile kaybolmaz.
const saved = await api.getState();
state.photos = saved.photos;
state.outputDir = saved.outputDir;
render();
