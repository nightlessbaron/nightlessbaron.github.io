import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

// Total layout shift while the home page loads. Fonts are held back 400 ms, as on a slow
// connection, so a late font swap that reflows the text would show up here.
for (const [width, height] of [[1280, 900], [390, 800]]) {
  test(`the page does not jump while fonts load (${width}px)`, () => withPage({ width, height }, async (page, base) => {
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; }))
        .observe({ type: 'layout-shift', buffered: true });
    });
    await page.route(/\.woff2?(\?|$)|fonts\.(googleapis|gstatic)\.com/, async r => { await new Promise(s => setTimeout(s, 400)); await r.continue(); });
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => window.__cls);
    assert.ok(cls < .02, `layout shift ${cls.toFixed(3)}`);
  }));
}

test('fonts are served from the site itself, so loading the page contacts no one else', () => withPage({}, async (page, base) => {
  const urls = [];
  page.on('request', r => urls.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(urls.filter(u => !u.startsWith(base) && !u.startsWith('data:')), []);
  const fonts = urls.filter(u => /\/fonts\/.+\.woff2$/.test(u));
  assert.ok(fonts.length >= 2, `self-hosted fonts requested: ${fonts}`);
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'Lato' && f.status === 'loaded').length);
  assert.ok(loaded >= 2, `${loaded} Lato faces loaded`);
  assert.deepEqual(page.__errors, []);
}));

test('link previews use a large 1200×630 card', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const meta = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property], meta[name]')]
    .map(m => [m.getAttribute('property') || m.getAttribute('name'), m.content])));
  assert.equal(meta['twitter:card'], 'summary_large_image');
  assert.equal(meta['og:image:width'], '1200');
  assert.equal(meta['og:image:height'], '630');
  assert.ok(meta['og:image:alt']?.length > 20, 'card has alt text');
  assert.match(meta['og:image'], /^https:\/\/nightlessbaron\.github\.io\/media\/card\.(jpg|png)$/);
  const local = base + new URL(meta['og:image']).pathname;
  const res = await page.request.get(local);
  assert.equal(res.status(), 200);
  assert.ok((await res.body()).length < 300e3, 'card under 300 KB');
  const size = await page.evaluate(src => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = src; }), local);
  assert.deepEqual(size, [1200, 630]);
}));

test('structured data describes Varad and matches the profile links on the page', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const ld = JSON.parse(await page.$eval('script[type="application/ld+json"]', s => s.textContent));
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, 'Varad Pimpalkhute');
  assert.equal(ld.url, 'https://nightlessbaron.github.io/');
  assert.match(ld.worksFor?.name ?? '', /Institute of Foundation Models/);
  const links = await page.$$eval('.links a', as => as.map(a => a.href));
  for (const site of ['scholar.google.com', 'x.com', 'github.com', 'linkedin.com'])
    assert.ok(ld.sameAs.some(u => u.includes(site)), `sameAs has ${site}`);
  for (const u of ld.sameAs) assert.ok(links.includes(u), `${u} is also linked on the page`);
}));
