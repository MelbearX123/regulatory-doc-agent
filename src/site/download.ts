import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { ScrapeError } from '../errors';
import { logger } from '../logger';
import type { SavedFile } from '../types';
import { DIALOGS, LIST, TIMEOUTS } from './constants';

export interface FetchedFile {
  fileName: string;
  data: Buffer;
}

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export async function fetchRowFile(page: Page, row: Locator): Promise<FetchedFile> {
  await row.getByRole('button', { name: LIST.goGetIt }).click();
  return fetchFromDownloadDialog(page);
}

export async function fetchListFile(page: Page): Promise<FetchedFile> {
  await page.getByRole('button', { name: LIST.saveList }).first().click();
  return fetchFromDownloadDialog(page);
}

export async function saveFetchedFile(file: FetchedFile, dir: string): Promise<SavedFile> {
  const fileName = file.fileName.replace(UNSAFE_FILENAME_CHARS, '_');
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, file.data);
  return { fileName, filePath, sizeBytes: file.data.length };
}

export async function dismissDialogs(page: Page): Promise<void> {
  for (const dialog of await page.locator(DIALOGS.window).all()) {
    const button = dialog
      .getByRole('button', { name: DIALOGS.close })
      .or(dialog.getByRole('button', { name: DIALOGS.cancel }));
    await button.first().click({ timeout: 2_000 }).catch(() => undefined);
  }
}

// Fetches the file from the hidden iframe's URL instead of waiting for Playwright's
// download event, which doesn't fire for every file type (e.g. transcripts).
async function fetchFromDownloadDialog(page: Page): Promise<FetchedFile> {
  const exportDialog = page.locator(DIALOGS.window).filter({ hasText: DIALOGS.exportTitle });
  const downloadDialog = page.locator(DIALOGS.download).filter({ has: page.locator(DIALOGS.downloadButton) });

  await exportDialog.or(downloadDialog).first().waitFor({ timeout: TIMEOUTS.dialog });
  if (await exportDialog.isVisible()) {
    await exportDialog.getByRole('button', { name: DIALOGS.ok }).click();
    await downloadDialog.waitFor({ timeout: TIMEOUTS.dialog });
  }

  const button = downloadDialog.locator(DIALOGS.downloadButton).first();
  const fileName = (await button.innerText()).trim();
  const knownUrls = await downloadIframeUrls(page);
  await button.click();
  const url = await waitForNewDownloadUrl(page, knownUrls);

  const response = await page.context().request.get(url, { timeout: TIMEOUTS.fileFetch });
  if (!response.ok()) {
    throw new ScrapeError(`Download of ${fileName} failed with HTTP ${response.status()}`);
  }
  const data = await response.body();

  await downloadDialog.getByRole('button', { name: DIALOGS.close }).click();
  await downloadDialog.waitFor({ state: 'detached', timeout: TIMEOUTS.dialog });
  logger.debug({ fileName, bytes: data.length }, 'Fetched file');
  return { fileName, data };
}

async function downloadIframeUrls(page: Page): Promise<string[]> {
  return page
    .locator('iframe')
    .evaluateAll(
      (frames, marker) => frames.map((frame) => (frame as HTMLIFrameElement).src).filter((src) => src.includes(marker)),
      DIALOGS.downloadUrlMarker,
    );
}

// Earlier downloads leave their iframes behind, so wait for a URL we haven't seen yet.
async function waitForNewDownloadUrl(page: Page, knownUrls: string[]): Promise<string> {
  const handle = await page.waitForFunction(
    ({ marker, known }) =>
      Array.from(document.querySelectorAll('iframe'))
        .map((frame) => frame.src)
        .find((src) => src.includes(marker) && !known.includes(src)) ?? null,
    { marker: DIALOGS.downloadUrlMarker, known: knownUrls },
    { timeout: TIMEOUTS.dialog },
  );
  const url = await handle.jsonValue();
  if (typeof url !== 'string') throw new ScrapeError('Download dialog did not produce a download URL');
  return url;
}
