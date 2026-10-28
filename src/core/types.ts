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

export interface EmailContent {
  subject: string;
  text: string;
}

export interface InboundEmail extends EmailContent {
  from: string; // lowercased address
  messageId: string | null;
  references: string[];
  automated: boolean; // headers say software sent it: auto-reply, mailing list or bulk mail
}

export enum IgnoreReason {
  OWN_ADDRESS = 'ownAddress',
  NO_REPLY_SENDER = 'noReplySender',
  AUTOMATED = 'automated',
}

export enum ExtractionIssue {
  NONE = 'none',
  NO_MATTER_NUMBER = 'noMatterNumber',
  NO_DOC_TYPE = 'noDocType',
  MULTIPLE_REQUESTS = 'multipleRequests',
  NOT_A_REQUEST = 'notARequest',
}

export type ClarificationIssue = Exclude<ExtractionIssue, ExtractionIssue.NONE>;

export type ParseResult = { ok: true; request: MatterRequest } | { ok: false; issue: ClarificationIssue };

export enum ReplyKind {
  RESULT = 'result',
  NOT_FOUND = 'notFound',
  ERROR = 'error',
  CLARIFICATION = 'clarification',
}

export interface Reply {
  kind: ReplyKind;
  subject: string;
  text: string;
  attachment: SavedFile | null;
}
