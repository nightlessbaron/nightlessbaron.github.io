// Fixes from an outside web-developer review: things a strict reviewer would trip over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withPage, ROOT } from './helpers/browser.mjs';

const lum = rgb => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

test('the robot only takes clicks on its body, not on the empty corners of its box', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const hits = await page.evaluate(() => {
    const bot = document.querySelector('.bot'), r = bot.getBoundingClientRect();
    const at = (x, y) => bot.contains(document.elementFromPoint(x, y));
    return { corner: at(r.left + 3, r.top + 3), body: at(r.left + r.width / 2, r.top + r.height * .55) };
  });
  assert.deepEqual(hits, { corner: false, body: true });
}));

test('hovering the robot shows one line that stays put while the pointer moves over it', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const b = document.querySelector('.bot').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.move(r.x + r.w * .5, r.y + r.h * .55);
  await page.waitForTimeout(250);
  const first = await page.textContent('.bot .bubble');
  for (const [fx, fy] of [[.55, .3], [.5, .8], [.45, .55], [.6, .25]]) { await page.mouse.move(r.x + r.w * fx, r.y + r.h * fy, { steps: 4 }); await page.waitForTimeout(60); }
  assert.equal(await page.textContent('.bot .bubble'), first);
}));

test('keyboard focus and hover keep links readable in light mode', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.focus('.intro p a');
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); // make it :focus-visible
  const f = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.color, s.outlineColor, s.outlineStyle]; });
  assert.ok(contrast(f[0], bg) >= 4.5, `focused text ${f[0]}`);
  assert.equal(f[2], 'solid');
  assert.ok(contrast(f[1], bg) >= 3, `focus outline ${f[1]}`);
  await page.hover('.intro p a');
  const h = await page.$eval('.intro p a', a => getComputedStyle(a).color);
  assert.ok(contrast(h, bg) >= 4.5, `hovered link ${h}`);
}));

test('no empty placeholder boxes: papers with a figure show it, the rest show no box', async () => {
  for (const [width, shown] of [[1280, 'hidden'], [390, 'none']]) {
    await withPage({ width, height: 800 }, async (page, base) => {
      await page.goto(base + '/');
      const ph = await page.$$eval('.thumb.placeholder', ts => ts.map(t => [getComputedStyle(t).visibility, getComputedStyle(t).display]));
      for (const [vis, disp] of ph) assert.ok(width > 600 ? vis === shown : disp === shown, `${width}px placeholder ${vis}/${disp}`);
      for (const t of ['DocQIR-Emb', 'GEMS', 'MetaFaaS', 'CBIR'])
        assert.ok(await page.$$eval('.row', (rows, t) => !!rows.find(r => r.querySelector('.t').textContent.includes(t)).querySelector('.thumb img'), t), `${t} has a figure`);
    });
  }
});

test('LLM-era work sits under Research, not under "Earlier research" (which begins "Before LLMs")', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const earlier = await page.$$eval('#earlier .row .t', ts => ts.map(t => t.textContent));
  for (const t of ['DocQIR-Emb', 'Bottleneck Discovery', 'Relational Knowledge Discovery'])
    assert.ok(!earlier.some(x => x.includes(t)), `${t} is still under Earlier research`);
  const research = await page.$$eval('#research .row .t', ts => ts.map(t => t.textContent));
  assert.ok(research.some(x => x.includes('DocQIR-Emb')));
}));

test('news shows the latest items, keeps older ones one click away, and never scrolls inside the page', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const n = await page.evaluate(() => {
    const visible = [...document.querySelectorAll('#news li')].filter(li => li.checkVisibility()).length;
    const lists = [...document.querySelectorAll('#news ul')];
    return { visible, total: document.querySelectorAll('#news li').length, scrolls: lists.some(u => u.scrollHeight > u.clientHeight + 1),
      older: !!document.querySelector('#news details:not([open]) summary') };
  });
  assert.ok(n.visible >= 5 && n.visible <= 7, `${n.visible} visible`);
  assert.ok(n.total >= 25, 'nothing was dropped');
  assert.equal(n.scrolls, false);
  assert.equal(n.older, true);
  await page.click('#news summary');
  assert.equal(await page.$$eval('#news li', ls => ls.filter(li => li.checkVisibility()).length), n.total);
  const jan = await page.$$eval('#news li', ls => ls.find(l => l.textContent.startsWith('Jan 2026')).innerHTML);
  assert.match(jan, /arxiv\.org\/abs\/2603\.12151/);
}));

test('on a phone the contact links come right after the tagline, above the bio', () => withPage({ width: 390, height: 800, hasTouch: true }, async (page, base) => {
  await page.goto(base + '/');
  const y = await page.evaluate(() => ({ links: document.querySelector('.links').getBoundingClientRect().top,
    tagline: document.querySelector('#tagline').getBoundingClientRect().bottom, bio: document.querySelector('.intro p:not(#tagline):not(.links)').getBoundingClientRect().top }));
  assert.ok(y.links >= y.tagline && y.links < y.bio, JSON.stringify(y));
  assert.ok(y.links < 800, 'on the first screen');
}));

test('dark mode tones down the thumbnails and declares a dark colour scheme', () => withPage({ colorScheme: 'dark' }, async (page, base) => {
  await page.goto(base + '/');
  assert.match(await page.$eval('.thumb img', i => getComputedStyle(i).filter), /brightness\(0\.\d+\)/);
  assert.equal(await page.$eval('meta[name="color-scheme"]', m => m.content), 'light dark');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light dark');
}));

test('the tagline: never two candidate pop-ups at once, and balanced lines', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  let most = 0;
  for (let i = 0; i < 60; i++) { most = Math.max(most, await page.locator('#tagline .cands.on').count()); await page.waitForTimeout(30); }
  assert.ok(most <= 1, `${most} pop-ups at once`);
  assert.equal(await page.$eval('#tagline', el => getComputedStyle(el).textWrapStyle || getComputedStyle(el).textWrap), 'balance');
}));

test('if the tagline is already showing when its script arrives, it is not re-typed', () => withPage({}, async (page, base) => {
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/js/tagline.js', async r => { await held; await r.continue(); });
  await page.goto(base + '/', { waitUntil: 'commit' });
  await page.waitForTimeout(2500); // past the 1.2 s fallback: the sentence is visible
  release();
  await page.waitForFunction(() => document.querySelector('#tagline').classList.contains('ready'), null, { timeout: 10000 });
  assert.equal(await page.locator('#tagline .tok.pending, #tagline .cands.on').count(), 0);
}));

test('very large downloads say how big they are', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const links = await page.$$eval('a[href^="files/"]', as => as.map(a => [a.getAttribute('href'), a.textContent + (a.nextSibling?.textContent || '')]));
  for (const [href, text] of links) {
    if (fs.statSync(path.join(ROOT, decodeURIComponent(href))).size > 5e6) assert.match(text, /\d+ MB/, href);
  }
}));

test('paper videos: a play hint on touch screens, and a passing cursor downloads nothing', async () => {
  await withPage({ hasTouch: true, width: 390, height: 800 }, async (page, base) => {
    await page.goto(base + '/');
    assert.equal(await page.locator('.thumb[data-anim] .play').count(), await page.locator('.thumb[data-anim]').count());
  });
  await withPage({}, async (page, base) => {
    const vids = [];
    page.on('request', r => { if (/\.(mp4|webm)$/.test(r.url())) vids.push(r.url()); });
    await page.goto(base + '/');
    const row = await page.$('.row.hl .thumb[data-anim]');
    const b = await row.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(50);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    assert.deepEqual(vids, []);
    const first = await page.$eval('video.anim source', s => s.type);
    assert.equal(first, 'video/webm', 'the smaller WebM is offered first');
  });
});

test('structure: paper titles are headings, every paper has a link anchor, the footer is outside main', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.deepEqual([...new Set(await page.$$eval('.row .t', ts => ts.map(t => t.tagName)))], ['H3']);
  const ids = await page.$$eval('.row', rs => rs.map(r => r.id));
  assert.ok(ids.every(Boolean), 'every row has an id');
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.ok(ids.includes('isocompute') && ids.includes('rl360'));
  assert.equal(await page.$eval('footer', f => !!f.closest('main')), false);
  assert.match(await page.title(), /Research Scientist/);
}));

test('the 404 page points somewhere useful', () => withPage({}, async (page, base) => {
  await page.goto(base + '/no-such-page');
  const hrefs = await page.$$eval('main a', as => as.map(a => a.getAttribute('href')));
  for (const h of ['/', '/#research', '/files/VARAD_CV_ML.pdf']) assert.ok(hrefs.includes(h), h);
  page.__errors = page.__errors.filter(e => !e.startsWith('404 /no-such-page'));
}));

test('the contour canvas stays under ~4 megapixels on big high-density screens', () => withPage({ width: 2560, height: 1440, deviceScaleFactor: 2 }, async (page, base) => {
  await page.goto(base + '/');
  const px = await page.$eval('canvas.topo', c => c.width * c.height);
  assert.ok(px <= 4.2e6, `${(px / 1e6).toFixed(1)} MP`);
}));
