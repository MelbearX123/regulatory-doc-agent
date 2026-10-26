import type { Page } from 'playwright';
import { ScrapeError } from '../errors';
import { DocType, DocTypeSchema, type MatterMetadata, type TabCounts } from '../types';
import { HEADER_FIELDS, TAB_LABEL, layoutObjectSelector, type HeaderField } from './constants';

async function readHeaderField(page: Page, field: HeaderField): Promise<string | null> {
  const element = page.locator(layoutObjectSelector(HEADER_FIELDS[field])).first();
  if ((await element.count()) === 0) return null;
  const text = (await element.innerText()).replace(/\s+/g, ' ').trim();
  return text || null;
}

function toIsoDate(value: string | null, field: HeaderField): string | null {
  if (value === null) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new ScrapeError(`Unexpected ${field} format: "${value}"`);
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

export async function readMetadata(page: Page): Promise<MatterMetadata> {
  const matterNumber = await readHeaderField(page, 'matterNumber');
  const title = await readHeaderField(page, 'title');
  if (!matterNumber || !title) {
    throw new ScrapeError('Matter header has no matter number or title; the page layout may have changed');
  }

  return {
    matterNumber,
    title,
    type: await readHeaderField(page, 'type'),
    category: await readHeaderField(page, 'category'),
    status: await readHeaderField(page, 'status'),
    dateReceived: toIsoDate(await readHeaderField(page, 'dateReceived'), 'dateReceived'),
    finalDate: toIsoDate(await readHeaderField(page, 'finalDate'), 'finalDate'),
    outcome: await readHeaderField(page, 'outcome'),
  };
}

export async function readTabCounts(page: Page): Promise<TabCounts> {
  const labels = await page.getByRole('button', { name: TAB_LABEL }).allInnerTexts();
  const counts = new Map<DocType, number>();
  for (const label of labels) {
    const match = TAB_LABEL.exec(label.trim());
    if (match) counts.set(DocTypeSchema.parse(match[1]), Number(match[2]));
  }

  const countFor = (docType: DocType): number => {
    const count = counts.get(docType);
    if (count === undefined) throw new ScrapeError(`No "${docType}" tab found on the matter page`);
    return count;
  };
  return {
    [DocType.EXHIBITS]: countFor(DocType.EXHIBITS),
    [DocType.KEY_DOCUMENTS]: countFor(DocType.KEY_DOCUMENTS),
    [DocType.OTHER_DOCUMENTS]: countFor(DocType.OTHER_DOCUMENTS),
    [DocType.TRANSCRIPTS]: countFor(DocType.TRANSCRIPTS),
    [DocType.RECORDINGS]: countFor(DocType.RECORDINGS),
  };
}
