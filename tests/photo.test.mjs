// The photo arrives like a pixel-art diffusion sample: coloured noise first, then big blocks, then detail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

// What the canvas shows right now, or null when it's not covering the photo. The canvas is one pixel
// per cell (CSS scales it up, pixelated). `diff` is its mean |difference| (0–255) from the photo
// shrunk to the same grid with the same crop as the <img> (cover, 22% from the top); `rgb` its mean colour.
const look = page => page.evaluate(() => {
  const c = document.querySelector('.photo canvas'), img = document.querySelector('.photo img');
  if (!c || getComputedStyle(c).opacity === '0') return null;
  const n = c.width, d = c.getContext('2d').getImageData(0, 0, n, n).data;
  const ref = document.createElement('canvas'); ref.width = ref.height = n;
  const rg = ref.getContext('2d'), k = Math.max(n / img.naturalWidth, n / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  rg.drawImage(img, (n - dw) * .5, (n - dh) * .22, dw, dh);
  const r = rg.getImageData(0, 0, n, n).data, rgb = [0, 0, 0];
  let diff = 0;
  for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) { diff += Math.abs(d[i + ch] - r[i + ch]); rgb[ch] += d[i + ch]; }
  return { n, diff: diff / (n * n * 3), rgb: rgb.map(v => v / (n * n)), scheme: document.querySelector('.photo').dataset.scheme };
});
const frames = async (page, ms = 12000) => {
  const out = [], t0 = Date.now();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas') || document.body).opacity === '1', null, { timeout: 10000 });
  for (let f; Date.now() - t0 < ms && (f = await look(page)); await page.waitForTimeout(80)) out.push({ ...f, at: Date.now() - t0 });
  return out;
};

test('on load the photo is drawn out of red pixel noise, block by block, slowly, then the real photo shows', () => withPage({}, async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'commit' });
  await page.waitForSelector('.photo canvas', { state: 'attached', timeout: 10000 });
  const fs = await frames(page);
  assert.ok(fs.length > 10, `${fs.length} frames seen`);
  const [first, last] = [fs[0], fs.at(-1)];
  assert.equal(await page.locator('.photo .tstep').count(), 0, 'no t = … label');
  assert.doesNotMatch(await page.textContent('.photo'), /t\s*=/);
  assert.equal(await page.$eval('.photo canvas', c => getComputedStyle(c).imageRendering), 'pixelated');
  assert.ok(first.n <= 12, `starts as a few big blocks (${first.n} across)`);
  assert.ok(fs.every((f, i) => i === 0 || f.n >= fs[i - 1].n), `blocks only get finer: ${fs.map(f => f.n)}`);
  assert.ok(last.n >= 64, `ends fine-grained (${last.n} across)`);
  assert.equal(first.scheme, 'ember');
  const [r, g, b] = first.rgb;
  assert.ok(r > g + 30 && r > b + 30, `starts in a red scheme (mean rgb ${first.rgb.map(Math.round)})`);
  assert.ok(first.diff > 2.5 * last.diff && last.diff < 20, `converges on the photo: ${fs.map(f => Math.round(f.diff))}`);
  assert.ok(last.at >= 3000, `takes its time (${last.at} ms)`);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 10000 });
  assert.equal(await page.$eval('.photo img', i => getComputedStyle(i).visibility), 'visible');
  assert.deepEqual(page.__errors, []);
}));

test('each rerun starts from a different colour scheme', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 15000 });
  const seen = ['ember'];
  for (let i = 0; i < 2; i++) {
    await page.hover('.photo');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity !== '0', null, { timeout: 3000 });
    const s = await page.$eval('.photo', el => el.dataset.scheme);
    assert.notEqual(s, seen.at(-1), `rerun ${i + 1} repeated ${s}`);
    seen.push(s);
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 15000 });
  }
}));

test('resting the pointer on the photo (or tapping it) runs it again', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 15000 });
  await page.hover('.photo');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity !== '0', null, { timeout: 3000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.photo canvas')).opacity === '0', null, { timeout: 15000 });
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
