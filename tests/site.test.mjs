import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withPage, ROOT } from './helpers/browser.mjs';

const SKIP = new Set(['node_modules', 'tests', '.git', '.superpowers']);
const htmlFiles = (dir = ROOT) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  SKIP.has(d.name) ? [] : d.isDirectory() ? htmlFiles(path.join(dir, d.name)) : d.name.endsWith('.html') ? [path.join(dir, d.name)] : []);
const urlOf = f => '/' + path.relative(ROOT, f).replace(/index\.html$/, '');

test('every page: local links resolve, no errors, no GPU counts, has a title', () => withPage({}, async (page, base) => {
  const files = htmlFiles();
  assert.ok(files.length >= 18, `found ${files.length} pages`);
  for (const f of files) {
    const url = urlOf(f), html = fs.readFileSync(f, 'utf8');
    assert.match(html, /<title>[^<]+<\/title>/, `${url} has no title`);
    assert.doesNotMatch(html, /H200|2,048/, `${url} mentions a GPU count`);
    const refs = [...html.matchAll(/\s(?:href|src|data-src|poster)="([^"]+)"/g)].map(m => m[1])
      .filter(u => !/^(https?:|mailto:|#|data:)/.test(u));
    for (const r of new Set(refs)) {
      const target = new URL(r, base + url);
      const status = (await page.request.get(target.href)).status();
      assert.equal(status, 200, `${url} → ${r} is ${status}`);
    }
    if (/http-equiv="refresh"/.test(html) || url === '/404.html') continue;
    page.__errors = [];
    await page.goto(base + url, { waitUntil: 'networkidle' });
    assert.deepEqual(page.__errors, [], `${url} errors`);
  }
}));

test('the repo: static files for Pages, and media within budget', () => {
  const has = p => fs.existsSync(path.join(ROOT, p)), size = p => fs.statSync(path.join(ROOT, p)).size;
  assert.ok(has('.nojekyll') && !has('_config.yml'), 'served as-is, no Jekyll');
  assert.ok(has('files/VARAD_CV_ML.pdf'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const [, a, b] of html.matchAll(/<img[^>]*\ssrc="([^"]+)"|\sposter="([^"]+)"/g)) {
    const src = a || b;
    assert.match(src, /\.webp$/, src);
    assert.ok(size(src) < 1e5, `${src} under 100 KB`);
  }
  for (const m of ['isocompute', 'uno', 'rl360']) assert.ok(size(`media/${m}.mp4`) < 1.5e6, `media/${m}.mp4 under 1.5 MB`);
});
