import { DocType, StopReason, type FetchResult, type MatterMetadata, type SavedFile, type TabCounts } from './types';

export const M12205_METADATA: MatterMetadata = {
  matterNumber: 'M12205',
  title: 'Halifax Regional Water Commission - Windsor Street Exchange Redevelopment Project - $69,275,000',
  type: 'Capital Expenditure Approvals',
  category: 'Water',
  status: 'Closed',
  dateReceived: '2025-04-07',
  finalDate: '2025-10-23',
  outcome: 'Directions given',
};

export function tabCounts(overrides: Partial<TabCounts> = {}): TabCounts {
  return {
    [DocType.EXHIBITS]: 13,
    [DocType.KEY_DOCUMENTS]: 6,
    [DocType.OTHER_DOCUMENTS]: 43,
    [DocType.TRANSCRIPTS]: 0,
    [DocType.RECORDINGS]: 0,
    ...overrides,
  };
}

export function savedFile(fileName: string, sizeBytes = 1024): SavedFile {
  return { fileName, filePath: `/downloads/${fileName}`, sizeBytes };
}

export function savedFiles(count: number): SavedFile[] {
  return Array.from({ length: count }, (_, i) => savedFile(`${100000 + i}.pdf`));
}

export function documentsResult(
  docType: DocType,
  downloaded: number,
  options: { counts?: Partial<TabCounts>; stopReason?: StopReason; failedCount?: number } = {},
): FetchResult {
  return {
    metadata: M12205_METADATA,
    tabCounts: tabCounts(options.counts),
    request: { matterNumber: 'M12205', docType },
    download: {
      documents: savedFiles(downloaded),
      failedCount: options.failedCount ?? 0,
      stopReason: options.stopReason ?? StopReason.LIMIT,
    },
    recordings: null,
    zip: downloaded > 0 ? savedFile('M12205.zip') : null,
  };
}
