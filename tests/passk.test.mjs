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

// Deterministic randomness so pass@k outcomes are reproducible.
const SEEDED = () => { let s = 12345; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test('on a phone, pass@64 reaches the reward and the readout is on screen', () => withPage({ hasTouch: true, width: 375, height: 800 }, async (page, base) => {
  await page.addInitScript(SEEDED);
  await page.goto(base + '/');
  for (let i = 0; i < 4; i++) { await page.locator('#name').tap(); await page.waitForTimeout(1500); }
  const text = await hud(page).textContent();
  assert.match(text, /^n = 64 rollouts/);
  const k = +/· (\d+)\/64 reached/.exec(text)[1];
  assert.ok(k > 0, `pass@64 reached ${k}/64`);
  const box = await hud(page).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 800 && box.x >= 0 && box.x + box.width <= 375, `HUD at ${JSON.stringify(box)}`);
}));

test('in dark mode, missed rollouts stay visible against the background', () => withPage({ colorScheme: 'dark' }, async (page, base) => {
  await page.addInitScript(SEEDED);
  await page.goto(base + '/');
  await page.hover('#name');
  await page.waitForTimeout(1600);
  const median = await page.evaluate(() => {
    const c = document.querySelector('canvas.passk'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const bg = [17, 18, 20], L = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    const lum = ([r, g, b]) => .2126 * L(r) + .7152 * L(g) + .0722 * L(b);
    const cs = [];
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255; if (!a) continue;
      const px = [0, 1, 2].map(j => d[i + j] * a + bg[j] * (1 - a));
      if (d[i + 1] > d[i] * 1.6 && d[i + 1] > d[i + 2] * 1.2) continue; // skip green (reward hits)
      const [hi, lo] = [lum(px), lum(bg)].sort((x, y) => y - x);
      cs.push((hi + .05) / (lo + .05));
    }
    cs.sort((x, y) => x - y);
    return cs[Math.floor(cs.length / 2)]; // a typical miss stroke, not where many overlap
  });
  assert.ok(median >= 1.6, `median non-reward contrast ${median.toFixed(2)}`);
}));
