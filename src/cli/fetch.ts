import { MatterNotFoundError } from '../errors';
import { fetchMatter } from '../fetchMatter';
import { logger } from '../logger';
import { normalizeMatterNumber } from '../site/search';
import { DOC_TYPES, type MatterLookup } from '../types';

const USAGE = 'Usage: npm run fetch -- <matter number>\n  e.g. npm run fetch -- M12205';

function formatLookup({ metadata, tabCounts }: MatterLookup): string {
  const show = (value: string | null): string => value ?? '—';
  const counts = DOC_TYPES.map((docType) => `${docType} ${tabCounts[docType]}`).join(' · ');
  return [
    `${metadata.matterNumber} · ${show(metadata.status)} · ${show(metadata.type)} / ${show(metadata.category)}`,
    `  ${metadata.title}`,
    `  Received ${show(metadata.dateReceived)} · Decision ${show(metadata.decisionDate)} · Outcome: ${show(metadata.outcome)}`,
    `  ${counts}`,
  ].join('\n');
}

async function main(): Promise<number> {
  const rawMatter = process.argv[2];
  const matterNumber = rawMatter ? normalizeMatterNumber(rawMatter) : null;
  if (!matterNumber) {
    console.error(rawMatter ? `"${rawMatter}" is not a matter number (expected M + 5 digits).\n${USAGE}` : USAGE);
    return 1;
  }

  try {
    const lookup = await fetchMatter(matterNumber);
    console.log(`\n${formatLookup(lookup)}\n`);
    return 0;
  } catch (err) {
    if (err instanceof MatterNotFoundError) {
      logger.warn({ matterNumber }, err.message);
    } else {
      logger.error({ err, matterNumber }, 'Fetch failed');
    }
    return 1;
  }
}

// exitCode instead of process.exit() so pino can flush its last log lines.
process.exitCode = await main();
