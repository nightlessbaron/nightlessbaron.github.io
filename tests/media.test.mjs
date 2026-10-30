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
    assert.ok(size(`media/${m}-poster.webp`) < 1e5, `media/${m}-poster.webp under 100 KB`);
  }
});

test('still thumbnails for the other recent rows exist', () => {
  for (const s of STILLS) assert.ok(size(`media/${s}.webp`) < 1e5, `media/${s}.webp under 100 KB`);
});

test('the home page uses WebP for every thumbnail, poster and the photo', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const imgs = [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"|\sposter="([^"]+)"/g)].map(m => m[1] || m[2]);
  assert.ok(imgs.length >= 15, `found ${imgs.length} images`);
  for (const src of imgs) {
    assert.match(src, /\.webp$/, src);
    assert.ok(size(src) < 1e5, `${src} under 100 KB`);
  }
});

// The RL360 figure source lives in ../tools, outside the repo, so a fresh clone skips this check.
test('RL360 Fig 1 source is GPU-free and stripped to Fig 1', { skip: !fs.existsSync(TOOLS) && 'needs ../tools' }, () => {
  const src = fs.readFileSync(path.join(TOOLS, 'rl360-export/fig1.html'), 'utf8');
  assert.doesNotMatch(src, /H200/);
  assert.doesNotMatch(src, /gpus:/);
  const figs = [...src.matchAll(/data-fig="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(figs)], ['architecture']);
});
