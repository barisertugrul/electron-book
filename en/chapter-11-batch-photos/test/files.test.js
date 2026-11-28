// files.test.js — Scanning folders and finding a free file name.

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { collectFiles, findFreePath } from '../src/files.js';

let root;

before(async () => {
  // A temporary folder tree: holiday/a.jpg, holiday/day2/b.PNG, holiday/notes.txt, c.webp
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-photos-'));
  await fs.mkdir(path.join(root, 'holiday', 'day2'), { recursive: true });
  for (const file of ['holiday/a.jpg', 'holiday/day2/b.PNG', 'holiday/notes.txt', 'c.webp']) {
    await fs.writeFile(path.join(root, file), 'x');
  }
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('looks inside folders and skips unsupported files', async () => {
  const files = await collectFiles([path.join(root, 'holiday'), path.join(root, 'c.webp')]);
  assert.deepEqual(
    files.map((file) => path.relative(root, file).split(path.sep).join('/')),
    ['c.webp', 'holiday/a.jpg', 'holiday/day2/b.PNG'],
  );
});

test('a file dropped twice counts once, a missing path is skipped', async () => {
  const a = path.join(root, 'holiday', 'a.jpg');
  const files = await collectFiles([a, a, path.join(root, 'holiday'), path.join(root, 'missing.jpg')]);
  assert.equal(files.filter((file) => file === a).length, 1);
  assert.equal(files.length, 2);
});

test('findFreePath never overwrites an existing file', async () => {
  const target = path.join(root, 'holiday', 'a.jpg');
  assert.equal(await findFreePath(target), path.join(root, 'holiday', 'a-2.jpg'));
  assert.equal(await findFreePath(path.join(root, 'new.jpg')), path.join(root, 'new.jpg'));
});
