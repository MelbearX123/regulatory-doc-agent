import { chromium, type Page } from 'playwright';
import { appConfig } from '../config';
import { logger } from '../logger';

export async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  logger.debug({ headless: appConfig.headless }, 'Launching browser');
  const browser = await chromium.launch({ headless: appConfig.headless });
  try {
    // Files are fetched from their URL directly (see download.ts), so the browser's own copy isn't needed.
    // A tall window lets the virtualized document grid show 10+ rows without scrolling.
    const context = await browser.newContext({ acceptDownloads: false, viewport: { width: 1280, height: 1600 } });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await browser.close();
    logger.debug('Browser closed');
  }
}
