import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers/browser.mjs';

test('home page loads with title and no errors', () => withPage({}, async (page, base) => {
  await page.goto(base + '/');
  assert.equal(await page.title(), 'Varad Pimpalkhute');
  assert.deepEqual(page.__errors, []);
}));
