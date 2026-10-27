import { buildReply } from './buildReply';
import { composeClarificationReply } from './email/compose';
import { parseRequest } from './llm/parseRequest';
import { polishReply } from './llm/polishReply';
import { logger } from './logger';
import type { EmailContent, Reply } from './types';

export async function replyToEmail(email: EmailContent, outputDir: string): Promise<Reply> {
  const parsed = await parseRequest(email);
  if (!parsed.ok) {
    logger.info({ issue: parsed.issue }, 'Asking the sender to clarify');
    return composeClarificationReply(parsed.issue);
  }
  logger.info(parsed.request, 'Understood the request');
  return polishReply(await buildReply(parsed.request, outputDir));
}
