// Öğretici test: Markdown önizlemesi zararlı içeriği çalıştırmamalı.
//
// Not dosyası bir yerden indirilmiş, içine kötü niyetli HTML gömülmüş
// olabilir. Önizleme bu HTML'i çalıştırırsa, sayfa içinde istenmeyen kod
// çalışır. Bu testler, markdown.js'teki iki kuralımızın yerinde olduğunu
// kanıtlar.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../src/markdown.js';

test('normal Markdown HTML etiketlerine dönüşür', () => {
  const html = renderMarkdown('# Başlık\n\n**kalın** yazı');
  assert.match(html, /<h1>Başlık<\/h1>/);
  assert.match(html, /<strong>kalın<\/strong>/);
});

test('notun içindeki <script> etiketi çalışmaz, metin olarak görünür', () => {
  const html = renderMarkdown('<script>alert("merhaba")</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('olay öznitelikli resim etiketi (onerror) zararsız hale gelir', () => {
  const html = renderMarkdown('Resim: <img src="x" onerror="alert(1)">');
  assert.doesNotMatch(html, /<img/);
});

test('javascript: bağlantısı tıklanabilir olmaz', () => {
  const html = renderMarkdown('[tıkla](javascript:alert(1))');
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /tıkla/);
});

test('https bağlantısı korunur', () => {
  const html = renderMarkdown('[Electron](https://www.electronjs.org)');
  assert.match(html, /<a href="https:\/\/www\.electronjs\.org">Electron<\/a>/);
});
