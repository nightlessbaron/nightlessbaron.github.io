import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const RL = '.row.hl >> nth=1';           // RL360 row
const ISO = '.row.hl >> nth=0';          // IsoCompute row
const video = (page, sel) => page.locator(`${sel} >> video`);
const state = (page, sel) => video(page, sel).evaluate(v => ({ paused: v.paused, t: v.currentTime, rs: v.readyState }));
const videoRequests = reqs => reqs.filter(u => /\.(mp4|webm)$/.test(u));

test('video loads only on hover, plays, and pauses on leave', () => withPage({}, async (page, base) => {
  const reqs = []; page.on('request', r => reqs.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(videoRequests(reqs).length, 0);
  assert.equal((await state(page, RL)).rs, 0);
  await page.hover(RL);
  await page.waitForFunction(() => { const v = document.querySelectorAll('.row.hl')[1].querySelector('video'); return !v.paused && v.currentTime > 0; }, null, { timeout: 10000 });
  assert.ok(await page.locator(`${RL} >> .thumb.playing`).count() === 1);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  assert.equal((await state(page, RL)).paused, true);
  assert.equal(await page.locator(`${RL} >> .thumb.playing`).count(), 0);
  assert.deepEqual(page.__errors, []);
}));

test('poster visible while video loads', () => withPage({}, async (page, base) => {
  await page.route(/\.(mp4|webm)$/, async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue(); });
  await page.goto(base + '/');
  await page.hover(RL);
  await page.waitForTimeout(300);
  assert.equal(await page.locator(`${RL} >> img.still`).evaluate(i => getComputedStyle(i).opacity), '1');
}));

test('IsoCompute video loads only on hover', () => withPage({}, async (page, base) => {
  const reqs = []; page.on('request', r => reqs.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(reqs.filter(u => /isocompute\.(mp4|webm)$/.test(u)).length, 0);
  await page.hover(ISO);
  await page.locator(`${ISO} >> .thumb.playing`).waitFor({ timeout: 10000 });
  assert.ok(reqs.filter(u => /isocompute\.(mp4|webm)$/.test(u)).length > 0);
}));

test('touch tap toggles playback', () => withPage({ hasTouch: true, width: 375, height: 800 }, async (page, base) => {
  await page.goto(base + '/');
  const thumb = page.locator(`${RL} >> .thumb`);
  await thumb.scrollIntoViewIfNeeded();
  await thumb.tap();
  await page.waitForFunction(() => !document.querySelectorAll('.row.hl')[1].querySelector('video').paused, null, { timeout: 10000 });
  await thumb.tap();
  await page.waitForTimeout(200);
  assert.equal((await state(page, RL)).paused, true);
}));

test('reduced motion never autoplays; play button does', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.hover(RL);
  await page.waitForTimeout(800);
  assert.equal((await state(page, RL)).paused, true);
  const btn = page.locator(`${RL} >> .thumb button.play`);
  assert.equal(await btn.count(), 1);
  assert.equal(await btn.getAttribute('aria-pressed'), 'false');
  await btn.click();
  await page.waitForFunction(() => !document.querySelectorAll('.row.hl')[1].querySelector('video').paused, null, { timeout: 10000 });
  // A screen reader hears a toggle that says whether the animation is on, not "Play" while it plays.
  assert.equal(await btn.getAttribute('aria-pressed'), 'true');
  await btn.click();
  assert.equal(await btn.getAttribute('aria-pressed'), 'false');
  assert.equal((await state(page, RL)).paused, true);
}));
