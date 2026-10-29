import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const UMAMI_SCRIPT = 'https://cloud.umami.is/script.js', UMAMI_ID = '9cc9630e-58da-45b4-a135-88c8f41d3212';

// Visitor stats (Umami, cookieless). The test helper serves a pinned copy of Umami's script and
// answers everything else locally, so these tests run offline and never add to the real stats.
for (const path of ['/', '/travel/', '/no-such-page']) {
  test(`${path} carries the visitor counter, limited to the real domain`, () => withPage({}, async (page, base) => {
    await page.goto(base + path);
    const s = await page.$eval(`script[src="${UMAMI_SCRIPT}"]`, el => [el.dataset.websiteId, el.dataset.domains, el.defer]);
    assert.deepEqual(s, [UMAMI_ID, 'nightlessbaron.github.io', true]);
  }));
}

test('local previews are not counted', () => withPage({}, async (page, base) => {
  const sent = [];
  await page.route('**/api/send', r => { sent.push(r.request().url()); r.fulfill({ status: 200, body: '{}' }); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  assert.deepEqual(sent, []);
}));

test('a visit on nightlessbaron.github.io is counted with the right site id and page', () => withPage({}, async (page, base) => {
  const sent = [];
  // Serve the real domain from the local copy, and catch the hit instead of sending it.
  await page.route('https://nightlessbaron.github.io/**', async r => r.fulfill({ response: await page.request.get(base + new URL(r.request().url()).pathname) }));
  await page.route('**/api/send', r => { sent.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await page.goto('https://nightlessbaron.github.io/');
  for (let i = 0; i < 50 && !sent.length; i++) await page.waitForTimeout(100);
  assert.equal(sent.length, 1, 'one page view sent');
  assert.equal(sent[0].payload.website, UMAMI_ID);
  assert.equal(sent[0].payload.hostname, 'nightlessbaron.github.io');
  assert.equal(new URL(sent[0].payload.url, 'https://nightlessbaron.github.io').pathname, '/');
}));

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

test('fonts are served from the site itself, so loading the page contacts no one but the visitor counter', () => withPage({}, async (page, base) => {
  const urls = [];
  page.on('request', r => urls.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(urls.filter(u => !u.startsWith(base) && !u.startsWith('data:') && u !== UMAMI_SCRIPT), []);
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

for (const colorScheme of ['light', 'dark']) {
  test(`the phone browser bar matches the page background (${colorScheme})`, () => withPage({ colorScheme }, async (page, base) => {
    for (const path of ['/', '/travel/', '/no-such-page']) {
      await page.goto(base + path);
      const [meta, bg] = await page.evaluate(() => {
        const m = [...document.querySelectorAll('meta[name="theme-color"]')].find(m => !m.media || matchMedia(m.media).matches);
        const c = document.createElement('canvas').getContext('2d'); // normalise both colours to one notation
        const norm = x => { c.fillStyle = x; return c.fillStyle; };
        return [m && norm(m.content), norm(getComputedStyle(document.body).backgroundColor)];
      });
      assert.equal(meta, bg, path);
    }
  }));
}

test('profile links are marked rel="me"', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const rels = await page.$$eval('.links a[href^="http"]', as => as.map(a => [a.hostname, a.rel]));
  assert.ok(rels.length >= 4);
  for (const [host, rel] of rels) assert.match(rel, /\bme\b/, host);
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
