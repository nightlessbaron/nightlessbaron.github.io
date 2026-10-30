// An opt-in interactive figure in the IsoCompute row: the paper's fitted compute-optimal n*(C).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const readout = page => page.textContent('#isocompute .isofig .out');
const setC = (page, log10C) => page.$eval('#isocompute .isofig input[type=range]', (r, v) => {
  r.value = v; r.dispatchEvent(new Event('input', { bubbles: true }));
}, log10C);

test('the IsoCompute row offers the scaling law to play with, closed until asked', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const d = page.locator('#isocompute details.isofig');
  assert.equal(await d.count(), 1);
  assert.equal(await d.evaluate(el => el.open), false);
  await page.click('#isocompute .isofig summary');
  assert.equal(await page.locator('#isocompute .isofig svg path.curve').count(), 2, 'easy and hard curves');
  assert.deepEqual(page.__errors, []);
}));

test('dragging compute moves n* along the fitted curve from the paper (Fig. 7, 32 problems per batch)', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.click('#isocompute .isofig summary');
  await setC(page, 6); // 10^6 rollouts
  assert.match(await readout(page), /n\* ≈ 118\b/);
  assert.match(await readout(page), /\b265 steps\b/, 'M = C / (32 n*)'); // 1e6 / (32 * 117.7)
  await setC(page, 7);
  assert.match(await readout(page), /n\* ≈ 444\b/);
  await page.check('#isocompute .isofig input[value=hard]');
  await setC(page, 6);
  assert.match(await readout(page), /n\* ≈ 73\b/);
}));

test('the figure works from the keyboard and says what it shows', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.click('#isocompute .isofig summary');
  const r = page.locator('#isocompute .isofig input[type=range]');
  assert.match(await r.getAttribute('aria-valuetext'), /rollouts/);
  await r.focus();
  const before = await readout(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await readout(page), before);
  assert.equal(await page.$eval('#isocompute .isofig .out', o => o.getAttribute('aria-live')), 'polite');
  assert.match(await page.textContent('#isocompute .isofig figcaption'), /Qwen2\.5-7B/);
  assert.ok(await page.locator('#isocompute .isofig table tr').count() >= 4, 'a table with the same numbers');
}));

test('hovering the plot moves the compute line too', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.click('#isocompute .isofig summary');
  const b = await page.locator('#isocompute .isofig svg').boundingBox();
  await page.mouse.move(b.x + b.width * .9, b.y + b.height / 2);
  const hi = +(await page.inputValue('#isocompute .isofig input[type=range]'));
  await page.mouse.move(b.x + b.width * .3, b.y + b.height / 2);
  const lo = +(await page.inputValue('#isocompute .isofig input[type=range]'));
  assert.ok(hi > lo + .5, `${lo} → ${hi}`);
}));
