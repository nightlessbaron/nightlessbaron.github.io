import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withPage, ROOT } from './helpers/browser.mjs';

// axe-core's automated accessibility checks (WCAG 2 A/AA rules), after the tagline has decoded.
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

for (const colorScheme of ['light', 'dark']) {
  for (const page_ of ['/']) {
    test(`${page_} has no serious accessibility problems (${colorScheme})`, () => withPage({ colorScheme }, async (page, base) => {
      await page.goto(base + page_, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3500);
      // The contour canvas sits behind all the text, and axe gives up on contrast checks when an image
      // is behind the text ("incomplete", not a violation). It is nearly transparent, so judge without it.
      await page.evaluate(() => document.querySelectorAll('canvas.topo').forEach(c => c.remove()));
      await page.addScriptTag({ content: AXE });
      const found = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
        .filter(v => v.impact === 'serious' || v.impact === 'critical')
        .map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`));
      assert.deepEqual(found, []);
    }));
  }
}
