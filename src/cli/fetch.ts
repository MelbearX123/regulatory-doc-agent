import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { buildReply } from '../buildReply';
import { sendReply } from '../email/send';
import { logger } from '../logger';
import { normalizeMatterNumber, requestSlug } from '../request';
import { DOC_TYPES, ReplyKind, type DocType, type MatterRequest, type Reply } from '../types';

const USAGE = [
  'Usage: npm run fetch -- <matter number> <document type> [--send <email address>]',
  `  Document types: ${DOC_TYPES.join(', ')}`,
  '  e.g. npm run fetch -- M12205 "Other Documents" --send you@example.com',
].join('\n');

interface CliArgs {
  request: MatterRequest;
  sendTo: string | undefined;
}

function parseCliArgs(): CliArgs | null {
  let positionals: string[];
  let sendTo: string | undefined;
  try {
    const parsed = parseArgs({ allowPositionals: true, options: { send: { type: 'string' } } });
    positionals = parsed.positionals;
    sendTo = parsed.values.send;
  } catch (err) {
    console.error(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    return null;
  }

  const [rawMatter, rawDocType] = positionals;
  const matterNumber = rawMatter ? normalizeMatterNumber(rawMatter) : null;
  const docType = rawDocType ? parseDocType(rawDocType) : null;
  const validRecipient = sendTo === undefined || z.email().safeParse(sendTo).success;
  if (!matterNumber || !docType || !validRecipient) {
    if (rawMatter && !matterNumber) console.error(`"${rawMatter}" is not a matter number (expected M + 5 digits).`);
    if (rawDocType && !docType) console.error(`"${rawDocType}" is not a document type.`);
    if (!validRecipient) console.error(`"${sendTo}" is not an email address.`);
    console.error(USAGE);
    return null;
  }
  return { request: { matterNumber, docType }, sendTo };
}

function parseDocType(input: string): DocType | null {
  const wanted = input.trim().replace(/\s+/g, ' ').toLowerCase();
  return DOC_TYPES.find((docType) => docType.toLowerCase() === wanted) ?? null;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatReply(reply: Reply): string {
  const attachment = reply.attachment
    ? `${reply.attachment.filePath} (${formatSize(reply.attachment.sizeBytes)})`
    : 'none';
  return [`Subject: ${reply.subject}`, `Attachment: ${attachment}`, '', reply.text].join('\n');
}

async function main(): Promise<number> {
  const args = parseCliArgs();
  if (!args) return 1;
  const { request, sendTo } = args;

  const outputDir = path.resolve('downloads', requestSlug(request));
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const reply = await buildReply(request, outputDir);
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

// exitCode instead of process.exit() so pino can flush its last log lines.
process.exitCode = await main();
