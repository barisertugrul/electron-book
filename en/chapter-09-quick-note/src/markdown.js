// markdown.js — A small module that turns Markdown text into HTML.
//
// This file runs in the main process. We convert here because the renderer
// process cannot use npm packages directly. The renderer sends the text over
// IPC and gets the HTML back.

import { Marked } from 'marked';

// Link types we allow to be clickable in the preview.
// Dangerous addresses such as "javascript:" are not on this list.
const SAFE_LINK = /^(https?:|mailto:|#)/i;

// Makes characters that have a special meaning in HTML harmless.
// Example: the text "<b>" becomes "&lt;b&gt;" and is shown as is.
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// We create our own Marked instance and change two rules:
// 1. Raw HTML written inside a note is not executed; it is shown as text.
// 2. Only safe links become <a> tags.
const markdown = new Marked({
  gfm: true, // GitHub-flavored Markdown: tables, ~~strikethrough~~, etc.
  breaks: true, // A single Enter also starts a new line.
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!SAFE_LINK.test(href)) {
        return label; // Not safe: show only the text.
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr}>${label}</a>`;
    },
  },
});

export function renderMarkdown(text) {
  return markdown.parse(text ?? '');
}
