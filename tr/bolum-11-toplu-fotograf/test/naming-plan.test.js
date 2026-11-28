// naming-plan.test.js — Ad şablonu ve çıktı planının testleri.
//
// Bu testler kitapta anlatılıyor: binlerce fotoğrafı yeniden adlandırmadan
// önce, kuralların doğru ad ürettiğinden emin olmak istiyoruz. plan.js saf
// fonksiyonlardan oluştuğu için Electron'u hiç başlatmadan test edebiliriz.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildName, groupFolder, normalizeRules, planOutputs, sanitizeFileName } from '../src/shared/plan.js';

// Test fotoğrafı üretir. Ayı takvimdeki gibi veririz (11 = Kasım); Date ise
// ayı 0'dan saydığı için 1 çıkarırız. Tarihi yerel saatle kuruyoruz, çünkü
// uygulama da tarihleri yerel saatle gösterir.
function photo(name, year, month, day, hour = 12, minute = 0, second = 0) {
  return {
    path: `/fotograflar/${name}`,
    name,
    size: 1000,
    takenAt: new Date(year, month - 1, day, hour, minute, second).toISOString(),
  };
}

describe('buildName', () => {
  test('şablondaki kelimeleri fotoğrafın tarihiyle doldurur', () => {
    const name = buildName('{yıl}-{ay}-{gün}_{saat}{dakika}{saniye}', photo('IMG_1.JPG', 2026, 11, 7, 9, 5, 3), 1);
    assert.equal(name, '2026-11-07_090503');
  });

  test('{sıra} üç haneli, {ad} uzantısız asıl addır', () => {
    assert.equal(buildName('{sıra} {ad}', photo('IMG_2041.JPG', 2026, 1, 1), 7), '007 IMG_2041');
  });

  test('şablona yazılan "/" ve ".." klasör değiştiremez', () => {
    const name = buildName('../../{ad}', photo('a.jpg', 2026, 1, 1), 1);
    assert.equal(name, '..-..-a');
    assert.ok(!name.includes('/'));
  });

  test('şablon boş bir ad üretirse asıl ad kullanılır', () => {
    assert.equal(buildName('  ', photo('Tatil.jpg', 2026, 1, 1), 1), 'Tatil');
  });
});

describe('sanitizeFileName', () => {
  test('Windows\'ta yasak karakterleri ve sondaki noktayı temizler', () => {
    assert.equal(sanitizeFileName('a:b*c?.'), 'a-b-c-');
    assert.equal(sanitizeFileName('Tatil. '), 'Tatil');
  });

  test('aygıt adlarını (CON, NUL...) değiştirir', () => {
    assert.equal(sanitizeFileName('con'), 'con_');
  });
});

describe('groupFolder', () => {
  const sample = photo('a.jpg', 2026, 3, 9);
  test('yıla ve aya göre klasör', () => {
    assert.equal(groupFolder(sample, 'none'), '');
    assert.equal(groupFolder(sample, 'year'), '2026');
    assert.equal(groupFolder(sample, 'month'), '2026/2026-03');
  });
});

describe('planOutputs', () => {
  const rules = normalizeRules({ template: '{yıl}{ay}{gün}', grouping: 'month' });

  test('fotoğrafları tarihe göre sıralar, {sıra} bu sırayı izler', () => {
    const plan = planOutputs(
      [photo('yeni.jpg', 2026, 11, 2), photo('eski.jpg', 2026, 10, 30)],
      normalizeRules({ template: '{sıra}', grouping: 'none' }),
    );
    assert.deepEqual(
      plan.map((item) => item.target),
      ['001.jpg', '002.jpg'],
    );
    assert.equal(plan[0].photo.name, 'eski.jpg');
  });

  test('aynı ada düşen fotoğraflar -2, -3 ekiyle ayrılır', () => {
    const plan = planOutputs(
      [photo('a.jpg', 2026, 11, 1, 10), photo('b.jpg', 2026, 11, 1, 11), photo('c.JPEG', 2026, 11, 1, 12)],
      rules,
    );
    assert.deepEqual(
      plan.map((item) => item.target),
      ['2026/2026-11/20261101.jpg', '2026/2026-11/20261101-2.jpg', '2026/2026-11/20261101-3.jpg'],
    );
  });

  test('büyük-küçük harf farkı ayrı dosya sayılmaz (Windows)', () => {
    const plan = planOutputs(
      [photo('A.jpg', 2026, 1, 1, 10), photo('a.jpg', 2026, 1, 1, 11)],
      normalizeRules({ template: '{ad}', grouping: 'none' }),
    );
    assert.deepEqual(plan.map((item) => item.target), ['A.jpg', 'a-2.jpg']);
  });

  test('farklı klasördeki aynı ad çakışma sayılmaz', () => {
    const plan = planOutputs([photo('a.jpg', 2025, 12, 31), photo('b.jpg', 2026, 1, 1)], {
      ...rules,
      template: 'kapak',
      grouping: 'year',
    });
    assert.deepEqual(plan.map((item) => item.target), ['2025/kapak.jpg', '2026/kapak.jpg']);
  });
});

describe('normalizeRules', () => {
  test('bilinmeyen alanları atar, geçersiz değerleri varsayılana çeker', () => {
    const rules = normalizeRules({ grouping: 'hepsi', maxSize: 1234, quality: 500, extra: true });
    assert.equal(rules.grouping, 'month');
    assert.equal(rules.maxSize, 1920);
    assert.equal(rules.quality, 100);
    assert.equal('extra' in rules, false);
  });
});
