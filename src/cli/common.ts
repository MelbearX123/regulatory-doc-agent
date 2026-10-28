import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { sendReply } from '../email/send';
import { logger } from '../core/logger';
import { ReplyKind, type Reply } from '../core/types';

export function isEmailAddress(value: string): boolean {
  return z.email().safeParse(value).success;
}

export async function freshDownloadDir(name: string): Promise<string> {
  const dir = path.resolve('downloads', name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

// Prints the reply, emails it when asked, and returns the exit code (0 only for a result reply).
export async function finishWithReply(reply: Reply, sendTo: string | undefined): Promise<number> {
  console.log(`\n${formatReply(reply)}\n`);
  if (sendTo) {
    try {
      await sendReply(sendTo, reply);
    } catch (err) {
      logger.error({ err, to: sendTo }, 'Sending the reply failed');
      return 1;
    }
  }
  return reply.kind === ReplyKind.RESULT ? 0 : 1;
}

function formatReply(reply: Reply): string {
  const attachment = reply.attachment
    ? `${reply.attachment.filePath} (${formatSize(reply.attachment.sizeBytes)})`
    : 'none';
  return [`Subject: ${reply.subject}`, `Attachment: ${attachment}`, '', reply.text].join('\n');
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
