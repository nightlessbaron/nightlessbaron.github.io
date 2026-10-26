import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/browser.mjs';

const TOOLS = path.resolve(ROOT, '../tools');
const size = p => fs.statSync(path.join(ROOT, p)).size;
const MEDIA = ['isocompute', 'uno', 'rl360'];
const STILLS = ['k2-horizon', 'k2-v2', 'k2-think', 'simplan', 'softqe'];

test('hover media exist as mp4 + webm + poster within size budgets', () => {
  for (const m of MEDIA) {
    for (const ext of ['.mp4', '.webm']) assert.ok(fs.existsSync(path.join(ROOT, 'media', m + ext)), `media/${m}${ext}`);
    assert.ok(size(`media/${m}.mp4`) < 1.5e6, `media/${m}.mp4 under 1.5 MB`);
    assert.ok(size(`media/${m}-poster.png`) < 4e5, `media/${m}-poster.png under 400 KB`);
  }
});

test('still thumbnails for the other recent rows exist', () => {
  for (const s of STILLS) assert.ok(size(`media/${s}.png`) < 4e5, `media/${s}.png under 400 KB`);
});

test('RL360 Fig 1 source is GPU-free and stripped to Fig 1', () => {
  const src = fs.readFileSync(path.join(TOOLS, 'rl360-export/fig1.html'), 'utf8');
  assert.doesNotMatch(src, /H200/);
  assert.doesNotMatch(src, /gpus:/);
  const figs = [...src.matchAll(/data-fig="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(figs)], ['architecture']);
});
