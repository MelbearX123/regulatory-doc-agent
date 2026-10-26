import { logger } from './logger';
import { withBrowser } from './site/browser';
import { readMetadata, readTabCounts } from './site/metadata';
import { openMatter } from './site/search';
import type { MatterLookup } from './types';

/** Opens a matter on the site and returns its header metadata and per-tab document counts. */
export async function fetchMatter(matterNumber: string): Promise<MatterLookup> {
  return withBrowser(async (page) => {
    await openMatter(page, matterNumber);
    const metadata = await readMetadata(page);
    const tabCounts = await readTabCounts(page);
    logger.info({ matterNumber, tabCounts }, 'Read matter metadata and tab counts');
    return { metadata, tabCounts };
  });
}
