import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const TAGLINE = 'I work on the science and systems of reinforcement learning for LLM agents.';

test('page is complete without JS', () => withPage({ javaScriptEnabled: false }, async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.equal(await page.$eval('#tagline', el => el.textContent.trim()), TAGLINE);
  await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('.thumb img.still')].every(i => i.complete));
  const widths = await page.$$eval('.thumb img.still', imgs => imgs.map(i => [i.getAttribute('src'), i.naturalWidth]));
  assert.ok(widths.length >= 10);
  for (const [src, w] of widths) assert.ok(w > 0, `${src} did not load`);
}));

test('no horizontal scroll at 375px', () => withPage({ width: 375, height: 800 }, async (page, base) => {
  await page.goto(base + '/');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 375);
}));

const lum = c => {
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
};
const colors = page => page.evaluate(() => { const s = getComputedStyle(document.body); return [s.backgroundColor, s.color]; });

test('dark mode changes the palette and keeps contrast', async () => {
  let light;
  await withPage({}, async (page, base) => { await page.goto(base + '/'); light = await colors(page); });
  await withPage({ colorScheme: 'dark' }, async (page, base) => {
    await page.goto(base + '/');
    const [bg, fg] = await colors(page);
    assert.notEqual(bg, light[0]);
    const [a, b] = [lum(bg), lum(fg)].sort((x, y) => y - x);
    assert.ok((a + .05) / (b + .05) >= 4.5, `contrast ${(a + .05) / (b + .05)}`);
  });
});

test('first-load weight under 1.5 MB with no video requested', () => withPage({}, async (page, base) => {
  const sizes = [];
  page.on('requestfinished', async req => { const s = await req.sizes(); sizes.push([req.url(), s.responseBodySize + s.responseHeadersSize]); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const total = sizes.reduce((t, [, s]) => t + s, 0);
  assert.ok(total < 1.5e6, `first load ${total} bytes`);
  assert.equal(sizes.filter(([u]) => /\.(mp4|webm)$/.test(u)).length, 0);
}));

for (const width of [360, 320]) {
  test(`no horizontal scroll on a ${width}px phone after the tagline decodes`, () => withPage({ width, height: 780, hasTouch: true }, async (page, base) => {
    await page.goto(base + '/');
    await page.waitForTimeout(3000);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= width, `scrollWidth ${sw} > ${width}`);
  }));
}
