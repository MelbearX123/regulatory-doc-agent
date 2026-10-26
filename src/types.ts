import { z } from 'zod';

/** The document tabs on a matter page, spelled exactly as the site labels them. */
export const DOC_TYPES = ['Exhibits', 'Key Documents', 'Other Documents', 'Transcripts', 'Recordings'] as const;
export const DocTypeSchema = z.enum(DOC_TYPES);
export type DocType = z.infer<typeof DocTypeSchema>;

export interface MatterRequest {
  /** Canonical form, e.g. "M12205". */
  matterNumber: string;
  docType: DocType;
}

/** Header fields of a matter page. Dates are ISO (YYYY-MM-DD); empty fields are null. */
export interface MatterMetadata {
  matterNumber: string;
  title: string;
  type: string | null;
  category: string | null;
  status: string | null;
  dateReceived: string | null;
  decisionDate: string | null;
  outcome: string | null;
}

export type TabCounts = Record<DocType, number>;

export interface MatterLookup {
  metadata: MatterMetadata;
  tabCounts: TabCounts;
}
