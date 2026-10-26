// Runs a test body against the site in headless Chromium, collecting page errors,
// console errors and failed same-origin requests into page.__errors.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROMIUM = process.env.CHROMIUM_PATH
  || path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

export async function withPage(opts = {}, fn) {
  const { width = 1280, height = 900, reducedMotion = false, colorScheme = 'light',
    javaScriptEnabled = true, hasTouch = false } = opts;
  const server = await startServer(ROOT);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const context = await browser.newContext({
      viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
      colorScheme, javaScriptEnabled, hasTouch, isMobile: hasTouch,
    });
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
