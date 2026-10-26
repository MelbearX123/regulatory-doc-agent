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

/** Turns "m12205", "M 12205" or "12205" into "M12205". Returns null if it isn't a matter number. */
export function normalizeMatterNumber(input: string): string | null {
  const match = MATTER_NUMBER.exec(input.trim());
  return match ? `M${match[1]}` : null;
}

/**
 * Searches for a matter and leaves the page on its matter view.
 * Throws MatterNotFoundError if the site has no such matter, and ScrapeError if it
 * opened a different matter (the site silently falls back to M00001 on a bad search).
 */
export async function openMatter(page: Page, matterNumber: string): Promise<void> {
  logger.info({ matterNumber }, 'Opening search page');
  await page.goto(SITE_URL);
  await page.getByText(SEARCH.landingText).first().waitFor({ timeout: TIMEOUTS.pageLoad });

  // The box is a FileMaker div, not an <input>: its inner .text only becomes editable after a click.
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

  const shownText = await page.locator(layoutObjectSelector(HEADER_FIELDS.matterNumber)).first().innerText();
  const shown = normalizeMatterNumber(shownText);
  if (shown !== matterNumber) {
    throw new ScrapeError(`Asked for ${matterNumber} but the site opened "${shownText.trim()}"`);
  }
  logger.info({ matterNumber }, 'Matter page opened and verified');
}
