// The page works without JavaScript, fits a phone, and stays light.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const TAGLINE = 'I work on the science and systems of reinforcement learning for LLM agents.';

test('without JavaScript the page is complete: the tagline, the photo with no noise over it, every thumbnail', () => withPage({ javaScriptEnabled: false }, async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.equal(await page.$eval('#tagline', el => el.textContent.trim()), TAGLINE);
  const after = await page.$eval('.photo', el => { const s = getComputedStyle(el, '::after'); return { content: s.content, opacity: s.opacity }; });
  assert.ok(after.content === 'none' || after.opacity === '0', 'no noise over the photo');
  await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('.thumb img.still')].every(i => i.complete));
  const widths = await page.$$eval('.thumb img.still', imgs => imgs.map(i => [i.getAttribute('src'), i.naturalWidth]));
  assert.ok(widths.length >= 10);
  for (const [src, w] of widths) assert.ok(w > 0, `${src} did not load`);
}));

test('on a phone nothing scrolls sideways, and the robot stays off the text while you read', () => withPage({ width: 320, height: 780, hasTouch: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(3000); // the tagline has decoded
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 320, `scrollWidth ${sw}`);
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(1500);
  const bot = await page.$eval('.bot', b => ({ top: b.getBoundingClientRect().top, hidden: b.getAttribute('aria-hidden'), focusable: b.querySelectorAll('[tabindex], a, button').length }));
  assert.ok(bot.top >= 780, `the robot is below the window's edge (top ${bot.top})`);
  assert.deepEqual([bot.hidden, bot.focusable], ['true', 0], 'decorative, out of the tab order');
  assert.deepEqual(page.__errors, []);
}));

test('first load is under 500 KB and requests no video', () => withPage({}, async (page, base) => {
  const sizes = [];
  page.on('requestfinished', async req => { const s = await req.sizes(); sizes.push([req.url(), s.responseBodySize + s.responseHeadersSize]); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const total = sizes.reduce((t, [, s]) => t + s, 0);
  assert.ok(total < 5e5, `first load ${total} bytes`);
  assert.equal(sizes.filter(([u]) => /\.(mp4|webm)$/.test(u)).length, 0);
}));
