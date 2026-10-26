import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { MatterNotFoundError } from '../errors';
import { fetchMatter, requestSlug } from '../fetchMatter';
import { logger } from '../logger';
import { ATTACHMENT_BUDGET_BYTES } from '../site/constants';
import { normalizeMatterNumber } from '../site/search';
import { DOC_TYPES, StopReason, type DocType, type FetchResult } from '../types';

const USAGE = [
  'Usage: npm run fetch -- <matter number> <document type>',
  `  Document types: ${DOC_TYPES.join(', ')}`,
  '  e.g. npm run fetch -- M12205 "Other Documents"',
].join('\n');

function parseDocType(input: string): DocType | null {
  const wanted = input.trim().replace(/\s+/g, ' ').toLowerCase();
  return DOC_TYPES.find((docType) => docType.toLowerCase() === wanted) ?? null;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatMatter({ metadata, tabCounts }: FetchResult): string[] {
  const show = (value: string | null): string => value ?? '—';
  const counts = DOC_TYPES.map((docType) => `${docType} ${tabCounts[docType]}`).join(' · ');
  return [
    `${metadata.matterNumber} · ${show(metadata.status)} · ${show(metadata.type)} / ${show(metadata.category)}`,
    `  ${metadata.title}`,
    `  Received ${show(metadata.dateReceived)} · Final ${show(metadata.finalDate)} · Outcome: ${show(metadata.outcome)}`,
    `  ${counts}`,
  ];
}

function formatFiles(result: FetchResult): string[] {
  const { docType } = result.request;
  const total = result.tabCounts[docType];
  if (total === 0) return [`  No ${docType} in this matter; nothing to download.`];

  if (result.recordings) {
    const { rows, listFile } = result.recordings;
    return [
      `  ${total} Recordings, not downloaded (audio files are too large to email). First ${rows.length}:`,
      ...rows.map((row) => `    - ${row.description}`),
      listFile ? `  Recordings list: ${listFile.filePath} (${formatSize(listFile.sizeBytes)})` : '  Recordings list PDF: unavailable',
    ];
  }

  if (!result.download) return [];
  const { documents, failedCount, stopReason } = result.download;
  const lines = [
    `  Downloaded ${documents.length} of ${total} ${docType}${documents.length < total ? ' (first as listed on the site)' : ''}:`,
    ...documents.map((doc) => `    - ${doc.fileName} (${formatSize(doc.sizeBytes)})  ${doc.row.description}`),
  ];
  if (stopReason === StopReason.SIZE_BUDGET) {
    lines.push(`  Stopped early: the next file would exceed the ${formatSize(ATTACHMENT_BUDGET_BYTES)} email budget.`);
  }
  if (failedCount > 0) lines.push(`  ${failedCount} download(s) failed and were skipped.`);
  if (result.zip) lines.push(`  ZIP: ${result.zip.filePath} (${formatSize(result.zip.sizeBytes)})`);
  return lines;
}

async function main(): Promise<number> {
  const [rawMatter, rawDocType] = process.argv.slice(2);
  const matterNumber = rawMatter ? normalizeMatterNumber(rawMatter) : null;
  const docType = rawDocType ? parseDocType(rawDocType) : null;
  if (!matterNumber || !docType) {
    if (rawMatter && !matterNumber) console.error(`"${rawMatter}" is not a matter number (expected M + 5 digits).`);
    if (rawDocType && !docType) console.error(`"${rawDocType}" is not a document type.`);
    console.error(USAGE);
    return 1;
  }

  const request = { matterNumber, docType };
  const outputDir = path.resolve('downloads', requestSlug(request));
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  try {
    const result = await fetchMatter(request, outputDir);
    console.log(['', ...formatMatter(result), '', ...formatFiles(result), ''].join('\n'));
    return 0;
  } catch (err) {
    if (err instanceof MatterNotFoundError) {
      logger.warn({ matterNumber }, err.message);
    } else {
      logger.error({ err, matterNumber, docType }, 'Fetch failed');
    }
    return 1;
  }
}

// exitCode instead of process.exit() so pino can flush its last log lines.
process.exitCode = await main();
