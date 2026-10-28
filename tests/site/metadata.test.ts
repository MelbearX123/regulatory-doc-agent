import { describe, expect, it } from 'vitest';
import { ScrapeError } from '../../src/core/errors';
import { DocType } from '../../src/core/types';
import { parseTabCounts, toIsoDate } from '../../src/site/metadata';

const LABELS = ['Exhibits - 13', 'Key Documents - 6', 'Other Documents - 43', 'Transcripts - 0', 'Recordings - 0'];

describe('parseTabCounts', () => {
  it('reads the count from each tab label', () => {
    expect(parseTabCounts(LABELS)).toEqual({
      [DocType.EXHIBITS]: 13,
      [DocType.KEY_DOCUMENTS]: 6,
      [DocType.OTHER_DOCUMENTS]: 43,
      [DocType.TRANSCRIPTS]: 0,
      [DocType.RECORDINGS]: 0,
    });
  });

  it('ignores surrounding whitespace and unrelated buttons', () => {
    const counts = parseTabCounts([...LABELS.map((label) => `  ${label}\n`), 'Hearings', 'Related Matters']);
    expect(counts[DocType.OTHER_DOCUMENTS]).toBe(43);
  });

  it('throws when a tab is missing', () => {
    expect(() => parseTabCounts(LABELS.slice(0, 4))).toThrow(ScrapeError);
  });
});

describe('toIsoDate', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(toIsoDate('04/07/2025', 'dateReceived')).toBe('2025-04-07');
  });

  it('passes null through', () => {
    expect(toIsoDate(null, 'finalDate')).toBeNull();
  });

  it('throws on an unexpected format instead of guessing', () => {
    expect(() => toIsoDate('2025-04-07', 'dateReceived')).toThrow(ScrapeError);
  });
});
