// Facts and wording Varad confirmed on 2026-10-30.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

test('no stale "in review" manuscripts', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.doesNotMatch(await page.textContent('main'), /in review/i);
  assert.equal(await page.locator('.thumb.placeholder').count(), 0);
}));

test('the bio does not claim he mentored the IsoCompute interns', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.doesNotMatch(await page.textContent('.intro'), /mentored/i);
}));

test('pronunciation reads VUH-rud', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.match(await page.textContent('.dev'), /VUH-rud/);
}));

test('on a desktop every role pill sits on the last line of its title', () => withPage({ width: 1280, height: 900 }, async (page, base) => {
  await page.goto(base + '/');
  const off = await page.$$eval('.row .t', ts => ts.filter(t => t.querySelector('.pill')).map(t => {
    const rects = [...t.querySelector('a').getClientRects()], last = rects[rects.length - 1];
    const p = t.querySelector('.pill').getBoundingClientRect();
    return p.top > last.bottom - 2 ? t.textContent.trim() : null;
  }).filter(Boolean));
  assert.deepEqual(off, []);
}));

test('service lists the venues he reviews for', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const service = await page.$$eval('#misc dt', dts => dts.find(d => d.textContent === 'Service').nextElementSibling.textContent);
  for (const v of ['NeurIPS', 'ICLR', 'TMLR', 'EMNLP', 'NAACL', 'Nature Communications', 'IEEE Transactions on Image Processing', 'Elsevier'])
    assert.ok(service.includes(v), `Service missing ${v}`);
}));

test('a first-person get-in-touch line in the intro (his, not an IFM hiring line)', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const p = await page.$('.intro .reach');
  assert.ok(p, 'a .reach line in the intro');
  const text = await p.textContent();
  assert.match(text, /\bI'd love to hear from you\b/);
  assert.doesNotMatch(text, /hiring|IFM/i);
}));

test('a dated "Now" line leads the news', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const now = await page.$eval('#news .now', el => el.textContent);
  assert.match(now, /^Now\b/);
  assert.match(now, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d\b/, 'says when it was last true');
}));

test('Miscellanea leads with talks, awards and press, each linked to a source', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const misc = await page.$$eval('#misc dt', dts => dts.map(d => ({ t: d.textContent, text: d.nextElementSibling.textContent,
    links: [...d.nextElementSibling.querySelectorAll('a')].map(a => a.href) })));
  assert.deepEqual(misc.slice(0, 4).map(m => m.t), ['Talks', 'Awards', 'Press', 'Patents']);
  const [talks, awards, press, patents] = misc;
  assert.match(talks.text, /MIT Media Lab/);
  assert.ok(talks.links.includes('https://hardmode.media.mit.edu/'));
  assert.match(awards.text, /WeaveHacks/);
  assert.match(awards.text, /Seldonian/);
  assert.ok(awards.links.includes('https://devpost.com/software/reviveagent'));
  assert.ok(awards.links.includes('https://seldonian.cs.umass.edu/Tutorials/contest/'));
  assert.ok(press.links.some(h => h.startsWith('https://mbzuai.ac.ae/news/mbzuai-and-g42-launch-k2-think')));
  assert.ok(press.links.some(h => h.includes('articul8')));
  assert.match(patents.text, /12,718,151/);
  const service = misc.find(m => m.t === 'Service').text;
  assert.match(service, /Judge/);
  const mentor = await page.$$eval('#misc li', ls => ls.map(l => l.textContent).find(t => /Industry mentor/.test(t)));
  assert.ok(mentor, 'the UMass mentorship is listed');
  assert.doesNotMatch(mentor, /20\d\d|Spring|Fall|upcoming/i, 'kept vague: no dates until it starts');
}));

test('the talk and both wins are in the news, and IsoCompute still shows without a click', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const all = await page.$$eval('#news li', ls => ls.map(l => l.textContent));
  for (const re of [/^Mar 2026.*MIT/, /^Oct 2025.*WeaveHacks/, /^Apr 2023.*Seldonian/]) assert.ok(all.some(t => re.test(t)), String(re));
  const shown = await page.$$eval('#news li', ls => { const box = ls[0].closest('.news-box').getBoundingClientRect();
    return ls.filter(l => l.getBoundingClientRect().bottom <= box.bottom + 1).map(l => l.textContent); });
  assert.ok(shown.some(t => t.includes('IsoCompute')));
}));

test('Miscellanea lists one entry per line, years in their own column, no run-on separators', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  const dds = await page.$$eval('#misc dd', ds => ds.map(d => ({ items: d.querySelectorAll(':scope > ul > li').length, text: d.textContent })));
  assert.ok(dds.every(d => d.items >= 1), 'every category is a list');
  assert.ok(dds.every(d => !/ · /.test(d.text)), 'no middots between entries');
  const stacked = await page.$$eval('#misc ul', us => us.every(u => [...u.children].every((li, i, a) => i === 0 || li.getBoundingClientRect().top >= a[i - 1].getBoundingClientRect().bottom - 1)));
  assert.ok(stacked, 'each entry starts on its own line');
  const years = await page.$$eval('#misc li .y', ys => ys.map(y => [y.textContent.trim(), Math.round(y.getBoundingClientRect().right)]));
  assert.ok(years.length >= 6 && years.every(([t]) => /^(Fall )?20\d\d$/.test(t)), JSON.stringify(years));
  assert.equal(new Set(years.map(([, r]) => r)).size, 1, 'the years line up on the right');
}));
