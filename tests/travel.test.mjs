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

test('the gallery shows small WebP thumbnails, and each links to the full photo (so it works without JavaScript)', () => withPage({ javaScriptEnabled: false }, async (page, base) => {
  await page.goto(base + '/travel/');
  const figs = await page.$$eval('.gallery figure', fs => fs.map(f => ({ thumb: f.querySelector('img').getAttribute('src'), href: f.querySelector('a')?.getAttribute('href') })));
  assert.equal(figs.length, 6);
  for (const f of figs) {
    assert.match(f.thumb, /\/thumbs\/[a-z-]+\.webp$/);
    assert.match(f.href || '', /\.jpg$/, `${f.thumb} links to the full photo`);
    const r = await page.request.get(new URL(f.thumb, base + '/travel/').href);
    assert.ok((await r.body()).length < 1e5, `${f.thumb} under 100 KB`);
  }
}));

test('the lightbox has previous / next buttons for touch, and shows the full-size photo', () => withPage({ hasTouch: true, width: 390, height: 800 }, async (page, base) => {
  await page.goto(base + '/travel/');
  await page.locator('.gallery figure a').first().tap();
  const dlg = page.locator('dialog.lightbox[open]');
  await dlg.waitFor({ timeout: 3000 });
  assert.match(await dlg.locator('img').getAttribute('src'), /Places\/nagpur\.jpg$/);
  await dlg.locator('button.next').tap();
  assert.match(await dlg.locator('img').getAttribute('src'), /issaquah\.jpg$/);
  await dlg.locator('button.prev').tap();
  await dlg.locator('button.prev').tap();
  assert.match(await dlg.locator('img').getAttribute('src'), /acm-team\.jpg$/, 'wraps around');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 390);
}));

test('the travel copy reads cleanly and the captions match the photos', () => withPage({}, async (page, base) => {
  await page.goto(base + '/travel/');
  const text = await page.textContent('main');
  assert.doesNotMatch(text, /made me to be/);
  const caps = await page.$$eval('.gallery figcaption', cs => cs.map(c => c.textContent));
  assert.match(caps[1], /Issaquah/);
  assert.match(caps[2], /Gandhinagar/);
  assert.doesNotMatch(await page.getAttribute('img[src*="gandhinagar"]', 'alt'), /Ahmedabad/);
}));
