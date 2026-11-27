// Teaching test: the Markdown preview must not run harmful content.
//
// A note file may have been downloaded from somewhere, with malicious HTML
// embedded in it. If the preview ran that HTML, unwanted code would run in
// the page. These tests prove that the two rules in markdown.js are in place.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../src/markdown.js';

test('normal Markdown turns into HTML tags', () => {
  const html = renderMarkdown('# Heading\n\n**bold** text');
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test('a <script> tag inside the note does not run; it is shown as text', () => {
  const html = renderMarkdown('<script>alert("hello")</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('an image tag with an event attribute (onerror) is made harmless', () => {
  const html = renderMarkdown('Image: <img src="x" onerror="alert(1)">');
  assert.doesNotMatch(html, /<img/);
});

test('a javascript: link is not clickable', () => {
  const html = renderMarkdown('[click me](javascript:alert(1))');
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /click me/);
});

test('an https link is kept', () => {
  const html = renderMarkdown('[Electron](https://www.electronjs.org)');
  assert.match(html, /<a href="https:\/\/www\.electronjs\.org">Electron<\/a>/);
});
