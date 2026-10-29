import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const TAGLINE = 'I work on the science and systems of reinforcement learning for LLM agents.';
const rowTitles = (page, sel) => page.$$eval(sel, rows => rows.map(r => r.querySelector('.t').textContent.trim()));
const pillsOf = (page, title) => page.$$eval('.row', (rows, t) => {
  const r = rows.find(x => x.querySelector('.t').textContent.trim().startsWith(t));
  return r ? [...r.querySelectorAll('.pill')].map(p => p.textContent.trim()) : null;
}, title);

test('highlighted research rows in order with role pills', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const hl = await rowTitles(page, '#research .row.hl');
  assert.equal(hl.length, 4);
  ['IsoCompute Playbook', 'RL360', 'K2 Horizon', 'Unlocking Lossless Speedups'].forEach((t, i) => assert.ok(hl[i].startsWith(t), `${hl[i]} should start with ${t}`));
  assert.deepEqual(await pillsOf(page, 'RL360'), ['LEAD']);
  assert.deepEqual(await pillsOf(page, 'K2 Horizon'), ['CODING-AGENT POST-TRAINING LEAD']);
  assert.ok((await pillsOf(page, 'K2-V2')).includes('CORE CONTRIBUTOR'));
  assert.ok((await pillsOf(page, 'K2-Think')).includes('CORE CONTRIBUTOR'));
}));

test('earlier research is shown in full with corrected details', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const titles = await rowTitles(page, '#earlier .row');
  assert.ok(titles.length >= 13, `expected >= 13 earlier rows, got ${titles.length}`);
  for (const t of ['Multiwinner Voting', 'Parkinson', 'Digital Image Noise Estimation', 'GEMS', 'MetaFaaS'])
    assert.ok(titles.some(x => x.includes(t)), `missing earlier row: ${t}`);
  const row = t => page.$$eval('#earlier .row', (rows, t) => {
    const r = rows.find(x => x.querySelector('.t').textContent.includes(t));
    return { html: r.querySelector('.m').innerHTML, text: r.textContent, links: [...r.querySelectorAll('a')].map(a => a.getAttribute('href')) };
  }, t);
  const pd = await row('Parkinson');
  assert.ok(pd.links.includes('files/publications/EEG.pdf'));
  assert.match(pd.html, /^Shivani Dhok, <b>Varad Pimpalkhute<\/b>/);
  assert.equal((await row('Multiwinner')).html.trim(), '<b>Varad Pimpalkhute</b>');
  assert.match((await row('MetaFaaS')).text, /SIGMOD/);
}));

test('every paper row links to the paper (manuscripts in review aside)', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const unlinked = await page.$$eval('.row', rows => rows.filter(r => !r.querySelector('.body a') && !/Manuscript, in review/.test(r.textContent))
    .map(r => r.querySelector('.t').textContent.trim()));
  assert.deepEqual(unlinked, []);
  const links = t => page.$$eval('.row', (rows, t) => [...rows.find(r => r.querySelector('.t').textContent.includes(t)).querySelectorAll('a')].map(a => a.href), t);
  assert.ok((await links('DocQIR-Emb')).includes('https://proceedings.mlr.press/v322/ho26a.html'));
  const mf = await links('MetaFaaS');
  assert.ok(mf.includes('https://doi.org/10.1145/3530050.3532926'), 'MetaFaaS links its ACM DOI');
  assert.ok(mf.includes('https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12718151'), 'and its granted patent');
  const mfText = await page.$$eval('.row', rows => rows.find(r => r.textContent.includes('MetaFaaS')).textContent);
  assert.match(mfText, /US patent 12,718,151/);
  assert.doesNotMatch(mfText, /patent application/);
  assert.ok((await links('GEMS')).includes('https://patents.google.com/patent/US20240160949A1/en'), 'GEMS links its patent application');
}));

test('no citation-count badges', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.doesNotMatch(await page.textContent('main'), /citations/i);
  assert.equal(await page.locator('.pill.cite').count(), 0);
}));

test('copy, contact links and forbidden strings', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const text = await page.evaluate(() => document.body.innerText);
  assert.doesNotMatch(text, /2,?048/);
  assert.doesNotMatch(text, /H200/);
  assert.match(text, /वरद पिंपळखुटे/);
  assert.match(text, /4×/);
  assert.match(text, /1000s of GPUs/);
  assert.equal(await page.$eval('#tagline', el => el.textContent.trim()), TAGLINE);
  assert.equal(await page.locator('a[href="mailto:pimpalkhutevarad@gmail.com"]').count() > 0, true);
  assert.equal(await page.locator('a[href="files/VARAD_CV_ML.pdf"]').count() > 0, true);
  assert.equal(await page.locator('a[href*="travel"]').count(), 0);
  const misc = await page.$eval('#misc', el => el.textContent);
  for (const w of ['Metabolts', 'McCallum', 'Al-Shedivat', 'ACM-W']) assert.ok(misc.includes(w), `#misc missing ${w}`);
  const news = await page.$$eval('#news li', lis => lis.map(l => l.textContent));
  assert.ok(news.length >= 15, `news has ${news.length} items`);
  assert.match(news[0], /RL360/);
}));

test('every local href and src resolves', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const urls = await page.evaluate(() => [...document.querySelectorAll('[href],[src],[data-src],source[src]')]
    .flatMap(el => ['href', 'src', 'data-src'].map(a => el.getAttribute(a)).filter(Boolean))
    .filter(u => !/^(https?:|mailto:|#|data:)/.test(u)));
  assert.ok(urls.length > 20);
  for (const u of new Set(urls)) {
    const r = await page.request.get(new URL(u, base + '/').href);
    assert.equal(r.status(), 200, `${u} → ${r.status()}`);
  }
}));
