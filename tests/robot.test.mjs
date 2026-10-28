import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const botX = page => page.evaluate(() => document.querySelector('.bot').getBoundingClientRect().left);
const scrollToEnd = page => page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));

test('the robot is on the home page, decorative and out of the tab order', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const bot = page.locator('.bot');
  assert.equal(await bot.count(), 1);
  assert.equal(await bot.getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('.bot [tabindex], .bot a, .bot button').count(), 0);
  assert.deepEqual(page.__errors, []);
}));

test('it walks right as the page scrolls down, and stays on screen at the end', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const x0 = await botX(page);
  await scrollToEnd(page);
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => { const b = document.querySelector('.bot').getBoundingClientRect(); return { left: b.left, right: b.right }; });
  assert.ok(r.left > x0 + 600, `walked from ${x0} to ${r.left}`);
  assert.ok(r.right <= 1280, `right edge ${r.right}`);
}));

test('hovering shows a one-liner in a speech bubble', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  await page.hover('.bot');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bot .bubble')).opacity === '1');
  assert.ok((await page.locator('.bot .bubble').textContent()).trim().length > 10);
  await page.mouse.move(640, 300);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bot .bubble')).opacity === '0');
}));

test('a click runs a trick with a label, and sound starts only after the click', () => withPage({}, async (page, base) => {
  await page.addInitScript(() => {
    window.__audio = 0;
    const A = window.AudioContext;
    window.AudioContext = class extends A { constructor(...a) { super(...a); window.__audio++; } };
  });
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  await page.hover('.bot');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__audio), 0);
  await page.click('.bot');
  assert.equal(await page.evaluate(() => window.__audio), 1);
  await page.waitForSelector('.bot-tag');
  assert.ok((await page.locator('.bot-tag').first().textContent()).trim().length > 0);
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('.bot-tag').count(), 0, 'labels clean up after themselves');
  assert.deepEqual(page.__errors, []);
}));

test('five clicks in a row tire it out, and every trick shows up before any repeats', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await page.click('.bot');
    seen.push(await page.evaluate(() => document.querySelector('.bot').dataset.last));
    await page.waitForTimeout(1900);
  }
  assert.equal(new Set(seen).size, 5, `tricks: ${seen}`);
  for (let i = 0; i < 5; i++) await page.click('.bot', { delay: 10 }).then(() => page.waitForTimeout(i < 4 ? 0 : 50));
  assert.match(await page.locator('.bot-tag').last().textContent(), /tired/);
}));

test('on a phone, a tap shows a one-liner and nothing scrolls sideways', () => withPage({ hasTouch: true, width: 320, height: 700 }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  await page.locator('.bot').tap();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bot .bubble')).opacity === '1');
  const b = await page.evaluate(() => { const r = document.querySelector('.bot .bubble').getBoundingClientRect(); return [r.left, r.right]; });
  assert.ok(b[0] >= 0 && b[1] <= 320, `bubble spans ${b}`);
  await scrollToEnd(page);
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 320);
}));

test('with reduced motion it stays in the corner and a click is just a hop', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const x0 = await botX(page);
  assert.ok(x0 > 1100, `starts in the corner at ${x0}`);
  await scrollToEnd(page);
  await page.waitForTimeout(800);
  assert.equal(Math.round(await botX(page)), Math.round(x0));
  await page.click('.bot');
  assert.equal(await page.evaluate(() => document.querySelector('.bot').dataset.last), 'hop');
}));

test('the old pass@k easter egg is gone', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('canvas.passk, .passk-hud').count(), 0);
  assert.equal(await page.$eval('#name', el => getComputedStyle(el).cursor), 'auto');
  assert.equal((await fetch(base + '/js/passk.js')).status, 404);
}));
