import type { Page } from 'playwright';
import { MatterNotFoundError, ScrapeError } from '../errors';
import { logger } from '../logger';
import {
  HEADER_FIELDS,
  SEARCH,
  SITE_URL,
  TAB_LABEL,
  TIMEOUTS,
  TYPING_DELAY_MS,
  layoutObjectSelector,
} from './constants';

const MATTER_NUMBER = /^M?[\s-]*(\d{5})$/i;

export function normalizeMatterNumber(input: string): string | null {
  const match = MATTER_NUMBER.exec(input.trim());
  return match ? `M${match[1]}` : null;
}

export async function openMatter(page: Page, matterNumber: string): Promise<void> {
  logger.info({ matterNumber }, 'Opening search page');
  await page.goto(SITE_URL);
  await page.getByText(SEARCH.landingText).first().waitFor({ timeout: TIMEOUTS.pageLoad });

  // The box is a FileMaker div, not an <input>: its inner .text only becomes editable a moment after a click.
  const searchBox = page.locator('.fm-textarea').filter({ hasText: SEARCH.boxPlaceholder }).first();
  await searchBox.locator('.text').click();
  await page.waitForTimeout(TIMEOUTS.beforeTyping);
  await page.keyboard.type(matterNumber, { delay: TYPING_DELAY_MS });
  await page.keyboard.press('Enter');
  logger.debug({ matterNumber }, 'Search submitted');

  const matterView = page.getByRole('button', { name: TAB_LABEL }).first();
  const noRecords = page.getByText(SEARCH.noRecordsText);
  try {
    await matterView.or(noRecords).first().waitFor({ timeout: TIMEOUTS.searchResult });
  } catch (err) {
    throw new ScrapeError(`Search for ${matterNumber} returned nothing within ${TIMEOUTS.searchResult} ms`, {
      cause: err,
    });
  }
  if (await noRecords.isVisible()) {
    throw new MatterNotFoundError(matterNumber);
  }

  // A bad search can silently open M00001 instead of failing, so confirm we got the right matter.
  const shownText = await page.locator(layoutObjectSelector(HEADER_FIELDS.matterNumber)).first().innerText();
  const shown = normalizeMatterNumber(shownText);
  if (shown !== matterNumber) {
    throw new ScrapeError(`Asked for ${matterNumber} but the site opened "${shownText.trim()}"`);
  }
  logger.info({ matterNumber }, 'Matter page opened and verified');
}
