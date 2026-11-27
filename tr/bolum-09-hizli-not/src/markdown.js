// markdown.js — Markdown metnini HTML'e çeviren küçük modül.
//
// Bu dosya ana süreçte (main) çalışır. Çeviriyi burada yapmamızın sebebi,
// işleyici sürecin (renderer) npm paketlerine doğrudan erişememesidir.
// İşleyici metni IPC ile gönderir, HTML'i geri alır.

import { Marked } from 'marked';

// Önizlemede tıklanabilir olmasına izin verdiğimiz bağlantı türleri.
// "javascript:" gibi tehlikeli adresler bu listede yok.
const SAFE_LINK = /^(https?:|mailto:|#)/i;

// HTML'de özel anlamı olan karakterleri zararsız hale getirir.
// Örnek: "<b>" metni "&lt;b&gt;" olur ve ekranda olduğu gibi görünür.
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Kendi Marked örneğimizi kuruyoruz ve iki kuralı değiştiriyoruz:
// 1. Not içine yazılmış ham HTML çalıştırılmaz, metin olarak gösterilir.
// 2. Yalnızca güvenli bağlantılar <a> etiketine dönüşür.
const markdown = new Marked({
  gfm: true, // GitHub tarzı Markdown: tablolar, ~~üstü çizili~~ vb.
  breaks: true, // Tek Enter da yeni satır olsun.
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!SAFE_LINK.test(href)) {
        return label; // Güvenli değilse sadece yazıyı göster.
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr}>${label}</a>`;
    },
  },
});

export function renderMarkdown(text) {
  return markdown.parse(text ?? '');
}
