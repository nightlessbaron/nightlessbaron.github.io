import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const TAGLINE = 'I work on the science and systems of reinforcement learning for LLM agents.';
// The word each token settled on (its first text node), ignoring the candidate/logp overlays.
const words = page => page.$$eval('#tagline .tok', ts => ts.map(t => t.childNodes[0].textContent).join(' '));

test('decodes then settles to the exact sentence', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('#tagline .tok').count(), 13);
  assert.equal(await words(page), TAGLINE);
  assert.equal(await page.locator('#tagline .cands.on').count(), 0);
  assert.equal(await page.locator('#tagline .tok.pending').count(), 0);
}));

test('candidates appear during decode', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(200);
  const on = page.locator('#tagline .cands.on');
  assert.ok(await on.count() >= 1);
  assert.match(await on.first().locator(':scope > *').first().getAttribute('data-t'), /\d+%$/);
}));

test('hover shows logp after decode', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(3000);
  const tok = page.locator('#tagline .tok', { hasText: /^science/ }).first();
  await tok.hover();
  await page.waitForTimeout(250);
  const lp = tok.locator('.lp');
  assert.equal(await lp.getAttribute('data-t'), 'logp -0.65');
  assert.equal(await lp.evaluate(e => getComputedStyle(e).opacity), '1');
}));

test('reduced motion renders instantly', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#tagline .cands.on').count(), 0);
  assert.equal(await page.locator('#tagline .tok.pending').count(), 0);
  assert.equal(await words(page), TAGLINE);
}));
