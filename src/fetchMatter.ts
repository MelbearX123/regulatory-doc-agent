import path from 'node:path';
import { logger } from './logger';
import { requestSlug } from './request';
import { withBrowser } from './site/browser';
import { downloadDocuments, listRecordings, openTab } from './site/documentList';
import { readMetadata, readTabCounts } from './site/metadata';
import { openMatter } from './site/search';
import { DocType, type FetchResult, type MatterRequest } from './types';
import { zipFiles } from './zip';

export async function fetchMatter(request: MatterRequest, outputDir: string): Promise<FetchResult> {
  const { matterNumber, docType } = request;

  const scraped = await withBrowser(async (page) => {
    await openMatter(page, matterNumber);
    const metadata = await readMetadata(page);
    const tabCounts = await readTabCounts(page);
    logger.info({ matterNumber, tabCounts }, 'Read matter metadata and tab counts');

    const tabCount = tabCounts[docType];
    if (tabCount === 0) {
      logger.info({ docType }, 'Requested tab is empty; nothing to download');
      return { metadata, tabCounts, download: null, recordings: null };
    }

    await openTab(page, docType);
    if (docType === DocType.RECORDINGS) {
      return { metadata, tabCounts, download: null, recordings: await listRecordings(page, outputDir) };
    }
    return { metadata, tabCounts, download: await downloadDocuments(page, tabCount, outputDir), recordings: null };
  });

  const files = scraped.download?.documents ?? [];
  const zip =
    files.length > 0
      ? await zipFiles(
          files.map((file) => file.filePath),
          path.join(outputDir, `${requestSlug(request)}.zip`),
        )
      : null;
  if (zip) logger.info({ zip: zip.filePath, bytes: zip.sizeBytes }, 'Created ZIP');

  return { ...scraped, request, zip };
}
