// files.test.js — Klasör tarama ve boş dosya adı bulma.

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { collectFiles, findFreePath } from '../src/files.js';

let root;

before(async () => {
  // Geçici bir klasör ağacı: tatil/a.jpg, tatil/gun2/b.PNG, tatil/notlar.txt, c.webp
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'toplu-fotograf-'));
  await fs.mkdir(path.join(root, 'tatil', 'gun2'), { recursive: true });
  for (const file of ['tatil/a.jpg', 'tatil/gun2/b.PNG', 'tatil/notlar.txt', 'c.webp']) {
    await fs.writeFile(path.join(root, file), 'x');
  }
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('klasörlerin içine bakar, desteklenmeyen dosyaları atlar', async () => {
  const files = await collectFiles([path.join(root, 'tatil'), path.join(root, 'c.webp')]);
  assert.deepEqual(
    files.map((file) => path.relative(root, file).split(path.sep).join('/')),
    ['c.webp', 'tatil/a.jpg', 'tatil/gun2/b.PNG'],
  );
});

test('aynı dosya iki kez bırakılsa da bir kez sayılır, olmayan yol atlanır', async () => {
  const a = path.join(root, 'tatil', 'a.jpg');
  const files = await collectFiles([a, a, path.join(root, 'tatil'), path.join(root, 'yok.jpg')]);
  assert.equal(files.filter((file) => file === a).length, 1);
  assert.equal(files.length, 2);
});

test('findFreePath var olan dosyanın üstüne yazmaz', async () => {
  const target = path.join(root, 'tatil', 'a.jpg');
  assert.equal(await findFreePath(target), path.join(root, 'tatil', 'a-2.jpg'));
  assert.equal(await findFreePath(path.join(root, 'yeni.jpg')), path.join(root, 'yeni.jpg'));
});
