import { z } from 'zod';

// Values must match the site's tab labels exactly.
export enum DocType {
  EXHIBITS = 'Exhibits',
  KEY_DOCUMENTS = 'Key Documents',
  OTHER_DOCUMENTS = 'Other Documents',
  TRANSCRIPTS = 'Transcripts',
  RECORDINGS = 'Recordings',
}

export const DOC_TYPES: readonly DocType[] = Object.values(DocType);
export const DocTypeSchema = z.enum(DocType);

export interface MatterRequest {
  matterNumber: string;
  docType: DocType;
}

export interface MatterMetadata {
  matterNumber: string;
  title: string;
  type: string | null;
  category: string | null;
  status: string | null;
  dateReceived: string | null;
  // Labelled "Decision Date" or "Date Final Submission" depending on the matter.
  finalDate: string | null;
  outcome: string | null;
}

export type TabCounts = Record<DocType, number>;

export interface MatterLookup {
  metadata: MatterMetadata;
  tabCounts: TabCounts;
}

export interface SavedFile {
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export enum StopReason {
  LIMIT = 'limit',
  END_OF_LIST = 'endOfList',
  SIZE_BUDGET = 'sizeBudget',
}

export interface DownloadOutcome {
  documents: SavedFile[];
  failedCount: number;
  stopReason: StopReason;
}

export interface RecordingsListing {
  titles: string[];
  listFile: SavedFile | null;
}

export interface FetchResult extends MatterLookup {
  request: MatterRequest;
  download: DownloadOutcome | null;
  recordings: RecordingsListing | null;
  zip: SavedFile | null;
}

export enum ReplyKind {
  RESULT = 'result',
  NOT_FOUND = 'notFound',
  ERROR = 'error',
}

export interface Reply {
  kind: ReplyKind;
  subject: string;
  text: string;
  attachment: SavedFile | null;
}
