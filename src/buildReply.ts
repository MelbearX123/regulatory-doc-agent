import { composeErrorReply, composeNotFoundReply, composeResultReply } from './email/compose';
import { MatterNotFoundError } from './errors';
import { fetchMatter } from './fetchMatter';
import { logger } from './logger';
import type { MatterRequest, Reply } from './types';

// Every request gets a reply, so failures become a not-found or apology reply instead of an exception.
export async function buildReply(request: MatterRequest, outputDir: string): Promise<Reply> {
  try {
    return composeResultReply(await fetchMatter(request, outputDir));
  } catch (err) {
    if (err instanceof MatterNotFoundError) {
      logger.warn({ ...request }, err.message);
      return composeNotFoundReply(request);
    }
    logger.error({ err, ...request }, 'Fetch failed; replying with an apology');
    return composeErrorReply(request);
  }
}
