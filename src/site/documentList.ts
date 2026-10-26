import type { Locator, Page } from 'playwright';
import { ScrapeError } from '../errors';
import { logger } from '../logger';
import {
  StopReason,
  type DocType,
  type DocumentRow,
  type DownloadedDocument,
  type DownloadOutcome,
  type RecordingsListing,
  type SavedFile,
} from '../types';
import {
  ATTACHMENT_BUDGET_BYTES,
  LIST,
  MAX_CONSECUTIVE_FAILURES,
  MAX_DOCUMENTS,
  TIMEOUTS,
  tabButtonName,
} from './constants';
import { dismissDialogs, fetchListFile, fetchRowFile, saveFetchedFile, type FetchedFile } from './download';

type RowVisitor = (row: DocumentRow, element: Locator) => Promise<StopReason | null>;

export async function openTab(page: Page, docType: DocType): Promise<void> {
  await page.getByRole('button', { name: tabButtonName(docType) }).click();
  await page.getByRole('button', { name: LIST.goGetIt }).first().waitFor({ timeout: TIMEOUTS.tabLoad });
  logger.debug({ docType }, 'Tab opened');
}

export async function downloadDocuments(page: Page, tabCount: number, outputDir: string): Promise<DownloadOutcome> {
  const target = Math.min(tabCount, MAX_DOCUMENTS);
  const documents: DownloadedDocument[] = [];
  let totalBytes = 0;
  let failedCount = 0;
  let consecutiveFailures = 0;

  const stopReason = await visitRows(page, async (row, element) => {
    let file: FetchedFile;
    try {
      file = await fetchRowFile(page, element);
      consecutiveFailures = 0;
    } catch (err) {
      failedCount++;
      consecutiveFailures++;
      logger.warn({ err, row: row.description }, 'Download failed; skipping this row');
      await dismissDialogs(page);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new ScrapeError(`${consecutiveFailures} downloads failed in a row`, { cause: err });
      }
      return null;
    }

    if (totalBytes + file.data.length > ATTACHMENT_BUDGET_BYTES) {
      logger.info({ fileName: file.fileName, bytes: file.data.length }, 'Next file would exceed the email budget; stopping');
      return StopReason.SIZE_BUDGET;
    }
    const saved = await saveFetchedFile(file, outputDir);
    totalBytes += saved.sizeBytes;
    documents.push({ ...saved, row });
    logger.info(
      { fileName: saved.fileName, kb: Math.round(saved.sizeBytes / 1024), progress: `${documents.length}/${target}` },
      'Downloaded',
    );
    return documents.length >= target ? StopReason.LIMIT : null;
  });

  if (documents.length === 0 && failedCount > 0) {
    throw new ScrapeError(`All ${failedCount} download attempts failed`);
  }
  return { documents, failedCount, stopReason };
}

// Recordings are ~300 MB audio files, too large to email, so list them and attach the site's list PDF.
export async function listRecordings(page: Page, outputDir: string): Promise<RecordingsListing> {
  let listFile: SavedFile | null = null;
  try {
    listFile = await saveFetchedFile(await fetchListFile(page), outputDir);
  } catch (err) {
    logger.warn({ err }, 'Could not download the recordings list PDF; continuing without it');
    await dismissDialogs(page);
  }

  const rows: DocumentRow[] = [];
  await visitRows(page, async (row) => {
    rows.push(row);
    return rows.length >= MAX_DOCUMENTS ? StopReason.LIMIT : null;
  });
  return { rows, listFile };
}

// The grid is virtualized: rows scrolled out of view are removed from the DOM,
// so each row must be handled while it's rendered, then the grid scrolled.
async function visitRows(page: Page, visit: RowVisitor): Promise<StopReason> {
  const seen = new Set<string>();
  do {
    for (const { index, row } of await readRenderedRows(page)) {
      if (!row.description || seen.has(row.description)) continue;
      seen.add(row.description);
      const stop = await visit(row, page.locator(LIST.row).nth(index));
      if (stop) return stop;
    }
  } while (await scrollDown(page));
  return StopReason.END_OF_LIST;
}

// The grid recycles <tr> elements, so DOM order doesn't match on-screen order.
async function readRenderedRows(page: Page): Promise<{ index: number; row: DocumentRow }[]> {
  const rendered = await page
    .locator(LIST.row)
    .evaluateAll((elements) =>
      elements.map((el, index) => ({ index, top: el.getBoundingClientRect().top, text: (el as HTMLElement).innerText })),
    );
  return rendered.sort((a, b) => a.top - b.top).map(({ index, text }) => ({ index, row: toDocumentRow(text) }));
}

function toDocumentRow(text: string): DocumentRow {
  const description = text.replace(LIST.buttonLabels, ' ').replace(/\s+/g, ' ').trim();
  return { description, docNumber: LIST.docNumber.exec(description)?.[1] ?? null };
}

async function scrollDown(page: Page): Promise<boolean> {
  const moved = await page.locator(LIST.scroller).evaluateAll((scrollers) => {
    const scroller = scrollers.find((el) => el.scrollHeight > el.clientHeight);
    if (!scroller) return false;
    const before = scroller.scrollTop;
    scroller.scrollTop += scroller.clientHeight;
    return scroller.scrollTop > before;
  });
  if (moved) await page.waitForTimeout(TIMEOUTS.scrollSettle);
  return moved;
}
