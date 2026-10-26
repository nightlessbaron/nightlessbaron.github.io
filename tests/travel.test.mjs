import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

test('travel page exists, is unlisted, and loads all photos', () => withPage({}, async (page, base) => {
  const res = await page.goto(base + '/travel/');
  assert.equal(res.status(), 200);
  assert.equal(await page.getAttribute('meta[name="robots"]', 'content'), 'noindex, nofollow');
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } });
  await page.waitForFunction(() => [...document.querySelectorAll('figure img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
  assert.equal(await page.locator('figure img').count(), 6);
  assert.deepEqual(page.__errors, []);
}));

test('lightbox opens, steps with arrow keys, closes with Escape', () => withPage({}, async (page, base) => {
  await page.goto(base + '/travel/');
  await page.locator('figure img').first().click();
  const dlg = page.locator('dialog.lightbox[open]');
  await dlg.waitFor({ timeout: 2000 });
  assert.match(await dlg.locator('img').getAttribute('src'), /nagpur\.jpg$/);
  await page.keyboard.press('ArrowRight');
  assert.match(await dlg.locator('img').getAttribute('src'), /issaquah\.jpg$/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('dialog.lightbox[open]').count(), 0);
}));

test('travel page has no horizontal scroll at 375px', () => withPage({ width: 375, height: 800 }, async (page, base) => {
  await page.goto(base + '/travel/');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 375);
}));
