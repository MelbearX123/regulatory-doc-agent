import { chromium, type Page } from 'playwright';
import { appConfig } from '../config';
import { logger } from '../logger';

/** Launches Chromium, runs `fn` with a fresh page, and always closes the browser afterwards. */
export async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  logger.debug({ headless: appConfig.headless }, 'Launching browser');
  const browser = await chromium.launch({ headless: appConfig.headless });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await browser.close();
    logger.debug('Browser closed');
  }
}
