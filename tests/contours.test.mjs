import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

// Max alpha and mean colour of the inked pixels on the contour canvas.
const ink = page => page.evaluate(() => {
  const c = document.querySelector('canvas.topo'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0, max = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; max = Math.max(max, d[i + 3]); r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  return { n, max, rgb: [r / n, g / n, b / n] };
});

for (const path of ['/', '/travel/']) {
  test(`${path} has faint contour lines behind the content`, () => withPage({}, async (page, base) => {
    await page.goto(base + path);
    const c = page.locator('canvas.topo');
    assert.equal(await c.count(), 1);
    const s = await c.evaluate(el => { const cs = getComputedStyle(el); return [cs.position, cs.pointerEvents, Number(cs.zIndex), el.getAttribute('aria-hidden')]; });
    assert.deepEqual(s, ['fixed', 'none', -1, 'true']);
    const k = await ink(page);
    assert.ok(k.n > 2000, `only ${k.n} inked pixels`);
    assert.ok(k.max <= 40, `lines too strong: alpha ${k.max}`);
    const hit = await page.evaluate(() => { const a = document.querySelector('main a'), r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + 2, r.top + r.height / 2) === a; });
    assert.equal(hit, true, 'links stay clickable');
    assert.deepEqual(page.__errors, []);
  }));
}

test('contours switch to a light ink in dark mode', () => withPage({ colorScheme: 'dark' }, async (page, base) => {
  await page.goto(base + '/');
  const k = await ink(page);
  // Light mode inks rgb(42,81,96); dark mode a light teal. Faint pixels read back with coarse
  // rounding, so compare green and blue, which separate the two inks by a wide margin.
  assert.ok(k.rgb[1] > 140 && k.rgb[2] > 150, `dark-mode ink ${k.rgb}`);
}));

// A fingerprint of what is drawn, plus whether the canvas is shown unstretched and covers the viewport.
const drawn = page => page.evaluate(() => {
  const c = document.querySelector('canvas.topo'), d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 600)).data;
  let h = 0; for (let i = 3; i < d.length; i += 16) h = (h * 31 + d[i]) | 0;
  const r = c.getBoundingClientRect();
  return { h, covers: r.height >= innerHeight, unstretched: Math.abs(r.height * devicePixelRatio - c.height) < 2 };
});

test('on a phone the map stays put when the address bar hides', () =>
  withPage({ width: 390, height: 664, hasTouch: true, screen: { width: 390, height: 844 } }, async (page, base) => {
    await page.goto(base + '/');
    await page.waitForTimeout(300);
    const before = await drawn(page);
    await page.setViewportSize({ width: 390, height: 744 }); // the address bar slides away on scroll
    await page.waitForTimeout(400);
    const after = await drawn(page);
    assert.equal(after.h, before.h, 'contours were redrawn in a different place');
    assert.ok(after.covers && after.unstretched, JSON.stringify(after));
  }));

test('the map is redrawn to fit when the window gets narrower', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(300);
  const before = await drawn(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForTimeout(400);
  const after = await drawn(page);
  assert.notEqual(after.h, before.h);
  assert.ok(after.covers && after.unstretched, JSON.stringify(after));
  assert.equal(await page.evaluate(() => document.querySelector('canvas.topo').width), 1000);
}));

test('the page still reads without JavaScript (no canvas, plain background)', () => withPage({ javaScriptEnabled: false }, async (page, base) => {
  await page.goto(base + '/');
  assert.equal(await page.locator('canvas.topo').count(), 0);
}));
