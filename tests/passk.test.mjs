import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const hud = page => page.locator('.passk-hud');

test('hover runs pass@8 then pass@16', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForFunction(() => /^n = 8 rollouts/.test(document.querySelector('.passk-hud')?.textContent || ''), null, { timeout: 2000 });
  await page.mouse.move(5, 5);
  await page.hover('#name');
  await page.waitForFunction(() => /^n = 16 rollouts/.test(document.querySelector('.passk-hud')?.textContent || ''), null, { timeout: 2000 });
  assert.deepEqual(page.__errors, []);
}));

test('links under the canvas stay clickable', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForTimeout(600);
  const hit = await page.evaluate(() => {
    const a = document.querySelector('.links a'), r = a.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === a;
  });
  assert.equal(hit, true);
}));

test('clears after it finishes', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => { const c = document.querySelector('canvas.passk'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }));
  await page.waitForTimeout(4500);
  assert.equal((await hud(page).textContent()).trim(), '');
  const ink = await page.evaluate(() => { const c = document.querySelector('canvas.passk'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; });
  assert.equal(ink, 0);
}));

test('tap on name runs pass@k', () => withPage({ hasTouch: true, width: 375, height: 800 }, async (page, base) => {
  await page.goto(base + '/');
  await page.locator('#name').tap();
  await page.waitForFunction(() => /^n = 8/.test(document.querySelector('.passk-hud')?.textContent || ''), null, { timeout: 2000 });
}));

test('reduced motion disables it', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('canvas.passk').count(), 0);
  assert.equal(await hud(page).count(), 0);
}));
