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

test('standing idle is cheap, and it still wakes up the moment you scroll', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(3500); // let the tagline finish decoding
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const layouts = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
  const a = await layouts();
  await page.waitForTimeout(3000);
  const perSec = (await layouts() - a) / 3;
  assert.ok(perSec < 25, `${perSec.toFixed(0)} layouts a second while nothing is happening`);
  const x0 = await botX(page);
  await scrollToEnd(page);
  await page.waitForFunction(x => document.querySelector('.bot').getBoundingClientRect().left > x + 600, x0, { timeout: 10000 })
    .catch(() => assert.fail('it did not walk after the scroll'));
}));

// The first translate() in the eyes' transform is where they look: [right, down].
const gaze = page => page.$eval('.bot [data-p=eyesOpen]', el => el.getAttribute('transform').match(/-?[\d.]+/g).slice(0, 2).map(Number));

test('its eyes follow the cursor', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  await page.mouse.move(1200, 60); // up and to the right of the robot
  await page.waitForTimeout(300);
  const [gx1, gy1] = await gaze(page);
  assert.ok(gx1 > 1 && gy1 < -.3, `looking at ${gx1},${gy1}`);
  await page.mouse.move(2, 898); // down and to its left
  await page.waitForTimeout(300);
  const [gx2, gy2] = await gaze(page);
  assert.ok(gx2 < -.5 && gy2 > .3, `looking at ${gx2},${gy2}`);
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

// The robot's box, and how much of it is above the bottom of the window.
const box = page => page.evaluate(() => { const r = document.querySelector('.bot').getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, shown: (innerHeight - r.top) / r.height }; });
// Resolves once the robot has stopped moving (same box for 400 ms).
const settled = async page => {
  const at = () => page.$eval('.bot', b => { const r = b.getBoundingClientRect(); return `${r.left.toFixed(1)},${r.top.toFixed(1)}`; });
  for (let t0 = Date.now(), a = await at(); Date.now() - t0 < 10000;) {
    await page.waitForTimeout(400);
    const b = await at();
    if (b === a) return;
    a = b;
  }
  assert.fail('the robot never stood still');
};
// The head is the top of the robot: that is what a finger lands on while it peeks.
const tapHead = page => page.locator('.bot .hit rect').first().tap({ force: true });

test('on a wide screen it never stands over the text: it walks in the margins and crosses once, halfway down', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const col = await page.$eval('main', m => { const r = m.getBoundingClientRect(); return [r.left, r.right]; });
  const xs = [];
  for (const f of [0, .2, .45, .55, .8, 1]) {
    await page.evaluate(f => scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), f);
    await settled(page);
    const b = await box(page);
    assert.ok(b.right <= col[0] || b.left >= col[1], `at ${f * 100}% it stands over the text (${b.left}–${b.right}, text ${col})`);
    assert.ok(b.bottom <= 900, 'fully on screen');
    xs.push(b.left);
  }
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), `walks right as you read: ${xs.map(Math.round)}`);
  assert.ok(xs[2] < col[0] && xs[3] > col[1], 'left margin for the first half, right margin for the second');
}));

test('where the corner is over the text (a phone, a narrow window) it stays out of sight while you read', async () => {
  for (const o of [{ width: 390, height: 800, hasTouch: true }, { width: 900, height: 800 }]) {
    await withPage(o, async (page, base) => {
      await page.goto(base + '/');
      for (const y of [0, 600]) {
        await page.evaluate(y => scrollTo(0, y), y);
        await settled(page);
        const b = await box(page);
        assert.ok(b.right > o.width - 30 && b.right <= o.width, `${o.width}px: in the right corner (${b.right})`);
        assert.ok(b.shown <= 0, `${o.width}px, scrolled ${y}px: ${Math.round(b.shown * 100)}% of it shows`);
      }
    });
  }
});

test('where the corner is clear of the text its head peeks up, climbs out to talk, and ducks back down after', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await settled(page);
  const b = await box(page);
  assert.ok(b.shown > .2 && b.shown < .5, `${Math.round(b.shown * 100)}% of it shows`);
  await page.mouse.move((b.left + b.right) / 2, b.top + 10);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bot .bubble')).opacity === '1');
  await settled(page);
  assert.ok((await box(page)).shown > .95, 'all of it is out');
  await page.mouse.move(300, 300);
  await settled(page);
  assert.ok((await box(page)).shown < .5, 'back to peeking');
}));

test('on a phone, at the end of the page, a tap gets a one-liner, a second tap a trick, and nothing scrolls sideways', () => withPage({ hasTouch: true, width: 320, height: 700 }, async (page, base) => {
  await page.goto(base + '/');
  await scrollToEnd(page);
  await page.waitForSelector('.bot-tag', { timeout: 10000 }); // it has climbed out
  await settled(page);
  await tapHead(page);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bot .bubble')).opacity === '1');
  const bb = await page.evaluate(() => { const r = document.querySelector('.bot .bubble').getBoundingClientRect(); return [r.left, r.right]; });
  assert.ok(bb[0] >= 0 && bb[1] <= 320, `bubble spans ${bb}`);
  await settled(page);
  await tapHead(page);
  assert.match(await page.evaluate(() => document.querySelector('.bot').dataset.last), /^(backflip|faceplant|dance|spin|hearts)$/);
  await scrollToEnd(page);
  await page.waitForTimeout(1200);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 320);
}));

test('at the end of the page it climbs out beside the footer and calls the episode done, once', async () => {
  for (const o of [{ width: 390, height: 800, hasTouch: true }, { width: 900, height: 800 }, { width: 1280, height: 900 }]) {
    await withPage(o, async (page, base) => {
      await page.goto(base + '/');
      await settled(page);
      await scrollToEnd(page);
      await page.waitForSelector('.bot-tag', { timeout: 10000 });
      assert.match(await page.textContent('.bot-tag'), /episode/i);
      await settled(page);
      const b = await box(page);
      assert.ok(b.shown > .95, `${o.width}px: all of it is out`);
      const f = await page.$eval('footer', f => { const r = f.lastElementChild.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; });
      const clear = f.bottom <= b.top + 1 || f.right <= b.left || f.left >= b.right;
      assert.ok(clear, `${o.width}px: the footer's last line (${JSON.stringify(f)}) is under the robot (${JSON.stringify(b)})`);
      await page.waitForFunction(() => !document.querySelector('.bot-tag'), null, { timeout: 5000 });
      await page.evaluate(() => scrollTo(0, 0)); await settled(page);
      await scrollToEnd(page); await page.waitForTimeout(1500);
      assert.equal(await page.locator('.bot-tag').count(), 0, 'only the first time');
    });
  }
});

test('with reduced motion it peeks from the corner, never walks, and a click is just a hop', () => withPage({ reducedMotion: true }, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const b0 = await box(page);
  assert.ok(b0.left > 1100, `in the corner at ${b0.left}`);
  assert.ok(b0.shown < .5, 'peeking');
  await page.evaluate(() => scrollTo(0, 800));
  await page.waitForTimeout(600);
  assert.equal(Math.round((await box(page)).left), Math.round(b0.left));
  await page.mouse.move((b0.left + b0.right) / 2, b0.top + 10);
  await page.mouse.down(); await page.mouse.up();
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
