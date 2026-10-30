// The words and facts on the home page: what Varad did, as he stated it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

const TAGLINE = 'I work on the science and systems of reinforcement learning for LLM agents.';
const rowTitles = (page, sel) => page.$$eval(sel, rows => rows.map(r => r.querySelector('.t').textContent.trim()));
const pillsOf = (page, title) => page.$$eval('.row', (rows, t) => {
  const r = rows.find(x => x.querySelector('.t').textContent.trim().startsWith(t));
  return r ? [...r.querySelectorAll('.pill')].map(p => p.textContent.trim()) : null;
}, title);
const linksOf = (page, title) => page.$$eval('.row', (rows, t) =>
  [...rows.find(r => r.querySelector('.t').textContent.includes(t)).querySelectorAll('a')].map(a => a.href), title);

test('research: highlighted rows and role pills, earlier work in full with corrected details, every paper linked', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const hl = await rowTitles(page, '#research .row.hl');
  assert.equal(hl.length, 4);
  ['IsoCompute Playbook', 'RL360', 'K2 Horizon', 'Unlocking Lossless Speedups'].forEach((t, i) => assert.ok(hl[i].startsWith(t), `${hl[i]} should start with ${t}`));
  assert.deepEqual(await pillsOf(page, 'RL360'), ['LEAD']);
  assert.deepEqual(await pillsOf(page, 'K2 Horizon'), ['CODING-AGENT LEAD']);
  assert.ok((await pillsOf(page, 'K2-V2')).includes('CORE CONTRIBUTOR'));
  assert.ok((await pillsOf(page, 'K2-Think')).includes('CORE CONTRIBUTOR'));

  const earlier = await rowTitles(page, '#earlier .row');
  for (const t of ['Multiwinner Voting', 'Parkinson', 'Digital Image Noise Estimation', 'GEMS', 'MetaFaaS'])
    assert.ok(earlier.some(x => x.includes(t)), `missing earlier row: ${t}`);
  const meta = t => page.$$eval('#earlier .row', (rows, t) => rows.find(x => x.querySelector('.t').textContent.includes(t)).querySelector('.m').innerHTML, t);
  assert.match(await meta('Parkinson'), /^Shivani Dhok, <b>Varad Pimpalkhute<\/b>/);
  assert.equal((await meta('Multiwinner')).trim(), '<b>Varad Pimpalkhute</b>');
  const mf = await page.$$eval('.row', rows => rows.find(r => r.textContent.includes('MetaFaaS')).textContent);
  assert.match(mf, /SIGMOD/);
  assert.match(mf, /US patent 12,718,151/);
  assert.ok((await linksOf(page, 'GEMS')).includes('https://patents.google.com/patent/US20240160949A1/en'));

  const unlinked = await page.$$eval('.row', rows => rows.filter(r => !r.querySelector('.body a')).map(r => r.querySelector('.t').textContent.trim()));
  assert.deepEqual(unlinked, []);
}));

test('facts and wording Varad set', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const text = await page.evaluate(() => document.body.innerText), bio = await page.$eval('.intro', el => el.innerText);
  assert.equal(await page.$eval('#tagline', el => el.textContent.trim()), TAGLINE);
  assert.match(text, /वरद पिंपळखुटे/);
  assert.match(await page.textContent('.dev'), /VUH-rud/);
  // never GPU counts, citation badges, stale manuscripts, or a mentoring claim
  for (const bad of [/2,?048/, /H200/, /citations/i, /in review/i, /400B/]) assert.doesNotMatch(text, bad);
  assert.doesNotMatch(bio, /mentored|small group/i);
  assert.match(text, /1000s of GPUs/);
  assert.match(bio, /where I lead post-training RL research for reasoning/);
  assert.match(bio, /4× the throughput of a synchronous RL baseline/);
  assert.match(bio, /375B MoE/);
  assert.match(await page.textContent('#isocompute .s'), /I helped frame the problem and design the experiments, and stress-tested the findings at scale on larger models\./);
  assert.match(await page.textContent('#k2-horizon .s'), /70\.2 on Terminal-Bench 2\.1 and 42\.6 on SWE-Bench Pro \(strict, no internet\)/);
  assert.equal(await page.textContent('#rl360 a[href*="wandb.ai"]'), 'W&B (demo run)');
  const reach = await page.textContent('.intro .reach');
  assert.match(reach, /\bI'd love to hear from you\b/);
  assert.doesNotMatch(reach, /hiring|IFM/i);
  const service = await page.$$eval('#misc dt', dts => dts.find(d => d.textContent === 'Service').nextElementSibling.textContent);
  for (const v of ['NeurIPS', 'ICLR', 'TMLR', 'EMNLP', 'NAACL', 'Nature Communications', 'IEEE Transactions on Image Processing', 'Elsevier'])
    assert.ok(service.includes(v), `Service missing ${v}`);
  assert.ok(await page.locator('a[href="mailto:pimpalkhutevarad@gmail.com"]').count() > 0);
  assert.ok(await page.locator('a[href="files/VARAD_CV_ML.pdf"]').count() > 0);
  assert.equal(await page.locator('a[href*="travel"]').count(), 0, 'the travel page is never linked');
  const press = await page.$$eval('#misc dt', dts => dts.find(d => d.textContent === 'Press').nextElementSibling.textContent);
  for (const o of ['Wired', 'VentureBeat', 'CNBC', 'Semafor', 'Euronews', 'The National', 'Khaleej Times']) assert.ok(press.includes(o), `Press missing ${o}`);
}));
