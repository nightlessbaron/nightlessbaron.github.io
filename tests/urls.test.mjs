// Old links keep working, the travel page stays unlisted, and visitors' browsers talk to no one but
// the visitor counter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const UMAMI_SCRIPT = 'https://cloud.umami.is/script.js', UMAMI_ID = '9cc9630e-58da-45b4-a135-88c8f41d3212';
const OLD = [
  ['/publications/', '/#research'], ['/teaching/', '/#misc'], ['/timeline/', '/#news'], ['/about/', '/'], ['/about.html', '/'],
  ...['2019-12-17-EEG', '2020-03-04-CAPS', '2020-11-19-WNUT', '2021-01-13-DIP-IEEE', '2021-01-24-META', '2021-06-10-SMM4H']
    .map(s => [`/publication/${s}`, '/#earlier']),
  ['/teaching/2019-summer-teaching', '/#misc'], ['/teaching/2019-sys-teaching', '/#misc'],
];

test('old URLs redirect, and unknown paths get the 404 page', () => withPage({}, async (page, base) => {
  for (const [from, to] of OLD) {
    await page.goto(base + from);
    await page.waitForURL(u => { const x = new URL(u); return x.pathname + x.hash === to; }, { timeout: 10000 })
      .catch(() => assert.fail(`${from} ended at ${page.url()}, expected ${to}`));
  }
  // these go to a PDF, which a browser downloads rather than navigates to, so check the stub itself
  for (const from of ['/cv/', '/resume/'])
    assert.match(await (await page.request.get(base + from)).text(), /http-equiv="refresh" content="0; url=\/files\/VARAD_CV_ML\.pdf"/, from);
  const res = await page.goto(base + '/nonexistent');
  assert.equal(res.status(), 404);
  assert.match(await page.textContent('body'), /Page not found/);
}));

// /travel/ stays unlisted through its own noindex. robots.txt must not block it: a blocked crawler never
// sees the noindex (so the bare URL can still be indexed), and robots.txt is public, so it would advertise the page.
test('the travel page works but stays unlisted: noindex, and not in robots.txt or the sitemap', () => withPage({}, async (page, base) => {
  assert.equal((await page.goto(base + '/travel/')).status(), 200);
  assert.equal(await page.getAttribute('meta[name="robots"]', 'content'), 'noindex, nofollow');
  assert.equal(await page.locator('figure img').count(), 6);
  for (const f of ['/robots.txt', '/sitemap.xml']) assert.doesNotMatch(await (await page.request.get(base + f)).text(), /travel/, f);
  assert.deepEqual(page.__errors, []);
}));

// The test helper serves a pinned copy of Umami's script and answers everything else locally, so
// this runs offline and never adds to the real stats.
test('loading the page contacts no one but the visitor counter, which counts only the real domain', () => withPage({}, async (page, base) => {
  const urls = [];
  page.on('request', r => urls.push(r.url()));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(urls.filter(u => !u.startsWith(base) && !u.startsWith('data:') && u !== UMAMI_SCRIPT), []);
  assert.ok(urls.filter(u => /\/fonts\/.+\.woff2$/.test(u)).length >= 2, 'fonts come from the site itself');
  const s = await page.$eval(`script[src="${UMAMI_SCRIPT}"]`, el => [el.dataset.websiteId, el.dataset.domains, el.dataset.doNotTrack]);
  assert.deepEqual(s, [UMAMI_ID, 'nightlessbaron.github.io', 'true']);
}));
