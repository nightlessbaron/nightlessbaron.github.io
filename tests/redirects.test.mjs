import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const PAGES = [
  ['/publications/', '/#research'], ['/teaching/', '/#misc'], ['/timeline/', '/#news'], ['/about/', '/'], ['/about.html', '/'],
  ...['2019-12-17-EEG', '2020-03-04-CAPS', '2020-11-19-WNUT', '2021-01-13-DIP-IEEE', '2021-01-24-META', '2021-06-10-SMM4H']
    .map(s => [`/publication/${s}`, '/#earlier']),
  ['/teaching/2019-summer-teaching', '/#misc'], ['/teaching/2019-sys-teaching', '/#misc'],
];
// These redirect to a PDF, which a browser downloads rather than navigates to; check the stub itself.
const TO_CV = ['/cv/', '/resume/'];

test('old URLs redirect', () => withPage({}, async (page, base) => {
  for (const [from, to] of PAGES) {
    await page.goto(base + from);
    await page.waitForURL(u => { const x = new URL(u); return x.pathname + x.hash === to; }, { timeout: 10000 })
      .catch(() => assert.fail(`${from} ended at ${page.url()}, expected ${to}`));
  }
  for (const from of TO_CV) {
    const html = await (await page.request.get(base + from)).text();
    assert.match(html, /http-equiv="refresh" content="0; url=\/files\/VARAD_CV_ML\.pdf"/, from);
  }
}));

// A canonical link already tells search engines where the page went; adding noindex as well
// sends them two conflicting signals, so the stubs carry only the canonical.
test('stubs have a canonical link and a visible fallback, and no noindex', () => withPage({}, async (page, base) => {
  const html = await (await page.request.get(base + '/publications/')).text();
  assert.match(html, /<link rel="canonical" href="https:\/\/nightlessbaron\.github\.io\/#research">/);
  assert.match(html, /<a href="\/#research">/);
  for (const from of [...PAGES.map(([f]) => f), ...TO_CV]) {
    const stub = await (await page.request.get(base + from)).text();
    assert.doesNotMatch(stub, /noindex/, from);
    assert.match(stub, /<link rel="canonical"/, from);
  }
}));

test('unknown paths get a styled 404', () => withPage({}, async (page, base) => {
  const res = await page.goto(base + '/nonexistent');
  assert.equal(res.status(), 404);
  assert.match(await page.textContent('body'), /Page not found/);
  page.__errors = page.__errors.filter(e => !e.startsWith('404 /nonexistent'));
  assert.deepEqual(page.__errors, []);
}));

test('robots.txt hides /travel/ and the sitemap omits it', () => withPage({}, async (page, base) => {
  const robots = await (await page.request.get(base + '/robots.txt')).text();
  assert.match(robots, /Disallow: \/travel\//);
  assert.match(robots, /Sitemap: https:\/\/nightlessbaron\.github\.io\/sitemap\.xml/);
  const sm = await page.request.get(base + '/sitemap.xml');
  assert.equal(sm.status(), 200);
  assert.doesNotMatch(await sm.text(), /travel/);
}));
