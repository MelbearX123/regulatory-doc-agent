import { z } from 'zod';
import { AGENT_NAME } from '../email/compose';
import { logger } from '../core/logger';
import { ReplyKind, type Reply } from '../core/types';
import { askForJson } from './client';

const RewriteSchema = z.object({ body: z.string() });

const SYSTEM_PROMPT = `You polish emails written by a document-retrieval agent so they read naturally and warmly.

Rules:
- Keep every fact exactly as written: matter numbers, titles, categories, dates and counts.
- Keep any list lines unchanged and in the same order.
- Do not add facts, numbers, dates, links or promises that are not in the original.
- Keep it about the same length. Start with "Hi," and sign off as "${AGENT_NAME}".

Return only the rewritten email body.`;

export async function polishReply(reply: Reply): Promise<Reply> {
  if (reply.kind !== ReplyKind.RESULT) return reply;
  try {
    const rewritten = (await askForJson(RewriteSchema, SYSTEM_PROMPT, reply.text)).body.trim();
    if (!sameFacts(reply.text, rewritten)) {
      logger.warn('LLM rewrite changed the facts; sending the template instead');
      return reply;
    }
    return { ...reply, text: rewritten };
  } catch (err) {
    logger.warn({ err }, 'LLM rewrite failed; sending the template instead');
    return reply;
  }
}

// Numbers carry the facts (matter numbers, counts, dates, amounts): the rewrite must contain exactly the same ones.
export function sameFacts(original: string, rewritten: string): boolean {
  const numbers = (text: string): string => (text.match(/\d+/g) ?? []).sort().join(',');
  return numbers(original) === numbers(rewritten);
}
