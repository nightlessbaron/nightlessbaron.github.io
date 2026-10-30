// The interactive pieces that carry content: the tagline, the IsoCompute figure, the news box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

test('the tagline decodes, then settles on the exact sentence', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(3500);
  const words = await page.$$eval('#tagline .tok', ts => ts.map(t => t.childNodes[0].textContent).join(' '));
  assert.equal(words, 'I work on the science and systems of reinforcement learning for LLM agents.');
  assert.equal(await page.locator('#tagline .cands.on, #tagline .tok.pending').count(), 0);
}));

test('the IsoCompute figure gives the paper\'s compute-optimal n* (Fig. 7, 32 problems per batch)', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.click('#isocompute .isofig summary');
  const range = '#isocompute .isofig input[type=range]';
  await page.waitForSelector(range); // built on the details' toggle event, a moment after the click
  const at = async (log10C, set) => {
    if (set) await page.check(`#isocompute .isofig input[value=${set}]`);
    await page.$eval(range, (r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, log10C);
    return page.textContent('#isocompute .isofig .out');
  };
  assert.match(await at(6), /n\* ≈ 118\b.*\b265 steps\b/);
  assert.match(await at(7), /n\* ≈ 444\b/);
  assert.match(await at(6, 'hard'), /n\* ≈ 73\b/);
}));

test('news scrolls in its own box, from the keyboard too', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const n = await page.$eval('#news .news-box', box => ({ scrolls: box.scrollHeight > box.clientHeight + 20, tab: box.tabIndex, label: box.getAttribute('aria-label'), total: box.querySelectorAll('li').length }));
  assert.deepEqual([n.scrolls, n.tab, !!n.label], [true, 0, true]);
  assert.ok(n.total >= 25, 'nothing was dropped');
  await page.focus('#news .news-box');
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('#news .news-box').scrollTop > 0, null, { timeout: 5000 });
}));
