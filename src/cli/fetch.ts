import { parseArgs } from 'node:util';
import { buildReply } from '../buildReply';
import { normalizeMatterNumber, requestSlug } from '../request';
import { DOC_TYPES, type DocType, type MatterRequest } from '../types';
import { finishWithReply, freshDownloadDir, isEmailAddress } from './common';

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
  const validRecipient = sendTo === undefined || isEmailAddress(sendTo);
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

async function main(): Promise<number> {
  const args = parseCliArgs();
  if (!args) return 1;
  const outputDir = await freshDownloadDir(requestSlug(args.request));
  return finishWithReply(await buildReply(args.request, outputDir), args.sendTo);
}

// exitCode instead of process.exit() so pino can flush its last log lines.
process.exitCode = await main();
