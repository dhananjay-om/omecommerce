import puppeteer, { type Browser } from 'puppeteer';
import type { PdfRenderer } from '../domain/ports.js';

/**
 * A single shared headless-Chromium instance, launched lazily on first use
 * and reused across renders — Chromium startup (~1-2s) is far more expensive
 * than reusing a browser across requests. `--no-sandbox`/`--disable-dev-shm-
 * usage`/`--disable-gpu` are required for Chromium to launch at all inside
 * this project's containerized dev/CI environments (confirmed: without
 * `--disable-dev-shm-usage`, the renderer process dies silently before
 * printing its DevTools WS endpoint and `launch()` times out).
 */
let browserPromise: Promise<Browser> | undefined;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
  return browserPromise;
}

export class PuppeteerPdfRenderer implements PdfRenderer {
  async render(html: string): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}
