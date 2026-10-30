// The photo arrives like a diffusion sample: noise first, then coarse shapes, then detail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

// How far the canvas is from the photo underneath it, and how noisy it is (mean |difference| between
// neighbouring pixels, 0–255): pure noise is very rough, a face is smooth.
const look = page => page.evaluate(() => {
  const c = document.querySelector('.photo canvas');
  if (!c || getComputedStyle(c).opacity === '0') return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let rough = 0, n = 0;
  for (let y = c.height * .3 | 0; y < c.height * .7; y++) for (let x = c.width * .3 | 0; x < c.width * .7; x++) {
    const i = (y * c.width + x) * 4; rough += Math.abs(d[i] - d[i + 4]); n++;
  }
  return { rough: rough / n, step: document.querySelector('.photo .tstep').textContent };
});

test('on load the photo denoises out of pure noise, counting t down to 0, then the real photo shows', () => withPage({}, async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'commit' });
  await page.waitForSelector('.photo canvas', { state: 'attached', timeout: 10000 });
  const frames = [];
  for (let i = 0; i < 40; i++) { const f = await look(page); if (f) frames.push(f); await page.waitForTimeout(60); }
  assert.ok(frames.length > 5, `${frames.length} frames seen`);
  assert.ok(frames[0].rough > 40, `starts as noise (roughness ${frames[0].rough.toFixed(0)})`);
  const steps = frames.map(f => +f.step.match(/\d+/)[0]);
  assert.ok(steps.every((s, i) => i === 0 || s <= steps[i - 1]), `t counts down: ${steps}`);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 10000 });
  assert.equal(await page.$eval('.photo img', i => getComputedStyle(i).visibility), 'visible');
  assert.deepEqual(page.__errors, []);
}));

test('resting the pointer on the photo (or tapping it) runs it again', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 10000 });
  await page.hover('.photo');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity !== '0', null, { timeout: 3000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 10000 });
}));

test('with reduced motion the photo is just there', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(300);
  const c = await page.$('.photo canvas');
  assert.ok(!c || await c.evaluate(c => getComputedStyle(c).opacity === '0'), 'no noise');
  await page.hover('.photo');
  await page.waitForTimeout(400);
  assert.ok(!c || await c.evaluate(c => getComputedStyle(c).opacity === '0'), 'not on hover either');
}));

test('if the script is late and the photo already showed, it does not turn back into noise', () => withPage({}, async (page, base) => {
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/js/photo.js', async r => { await held; await r.continue(); });
  await page.goto(base + '/', { waitUntil: 'commit' });
  await page.waitForTimeout(2500);
  assert.equal(await page.$eval('.photo', el => getComputedStyle(el, '::after').opacity), '0', 'the photo shows without the script');
  release();
  await page.waitForSelector('.photo.ready', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(200);
  assert.equal(await look(page), null);
}));

test('without JavaScript the photo shows with no noise over it', () => withPage({ javaScriptEnabled: false }, async (page, base) => {
  await page.goto(base + '/');
  const after = await page.$eval('.photo', el => { const s = getComputedStyle(el, '::after'); return { content: s.content, opacity: s.opacity }; });
  assert.ok(after.content === 'none' || after.opacity === '0');
}));
