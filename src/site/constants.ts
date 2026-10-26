import { DOC_TYPES } from '../types';

/** Everything specific to the UARB website lives here, so a site change means one file to fix. */

export const SITE_URL = 'https://uarb.novascotia.ca/fmi/webd/UARB15';

export const TIMEOUTS = {
  pageLoad: 30_000,
  searchResult: 20_000,
  /** The search box only becomes editable a moment after it's clicked. */
  beforeTyping: 1_000,
} as const;

/** Typing too fast can leave the search text uncommitted, which makes the site open M00001. */
export const TYPING_DELAY_MS = 50;

export const SEARCH = {
  landingText: 'Go Directly to Matter',
  /** Placeholder text inside the "Go Directly to Matter" box. */
  boxPlaceholder: /eg M01234/i,
  /** Dialog shown when a matter number doesn't exist. */
  noRecordsText: 'No Records Found',
} as const;

/**
 * FileMaker layout object numbers for the matter page header.
 * On screen the "Type" label sits above the category value (and vice versa);
 * these map by meaning, e.g. type = "Capital Expenditure Approvals", category = "Water".
 */
export const HEADER_FIELDS = {
  matterNumber: 286,
  status: 289,
  title: 290,
  type: 287,
  category: 298,
  dateReceived: 292,
  decisionDate: 294,
  outcome: 295,
} as const;

export type HeaderField = keyof typeof HEADER_FIELDS;

/**
 * CSS selector for a FileMaker layout object. Data fields carry an `fm_object_N` class;
 * text objects (like the title) only have a generated id such as `b0p0o290i0i0r1`.
 */
export function layoutObjectSelector(objectId: number): string {
  return `.fm_object_${objectId}, [id^="b0p0o${objectId}i"]`;
}

/** Tab buttons are labelled like "Other Documents - 43". Group 1 = doc type, group 2 = count. */
export const TAB_LABEL = new RegExp(`^(${DOC_TYPES.join('|')}) - (\\d+)$`);
