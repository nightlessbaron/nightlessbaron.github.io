// Runs a test body against the site in headless Chromium, collecting page errors,
// console errors and failed same-origin requests into page.__errors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const UMAMI = fs.readFileSync(path.join(ROOT, 'tests/fixtures/umami.js'));
const CHROMIUM = process.env.CHROMIUM_PATH
  || path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

export async function withPage(opts = {}, fn) {
  const { width = 1280, height = 900, reducedMotion = false, colorScheme = 'light',
    javaScriptEnabled = true, hasTouch = false, screen } = opts;
  const server = await startServer(ROOT);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    // `screen` lets a phone test have a screen taller than its viewport, as when the address bar is showing.
    const context = await browser.newContext({
      viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
      colorScheme, javaScriptEnabled, hasTouch, isMobile: hasTouch, ...(screen && { screen }),
    });
    // Visitor stats: tests get a pinned copy of Umami's script, and nothing they do reaches Umami.
    await context.route(/^https:\/\/[a-z]+\.umami\.is\//, r => /\/script\.js$/.test(r.request().url())
      ? r.fulfill({ contentType: 'application/javascript', body: UMAMI })
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const page = await context.newPage();
    page.__errors = [];
    page.on('pageerror', e => page.__errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.__errors.push('console: ' + m.text()); });
    page.on('response', r => {
      const u = new URL(r.url());
      // The browser's implicit /favicon.ico probe is not page content.
      if (u.origin === server.url && r.status() >= 400 && u.pathname !== '/favicon.ico') page.__errors.push(`${r.status()} ${u.pathname}`);
    });
    await fn(page, server.url);
  } finally {
    await browser.close();
    await server.close();
  }
}
