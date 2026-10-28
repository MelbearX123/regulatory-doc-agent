import { DOC_TYPES, type DocType } from '../types';

export const SITE_URL = 'https://uarb.novascotia.ca/fmi/webd/UARB15';

export const TIMEOUTS = {
  browserSession: 180_000,
  pageLoad: 30_000,
  searchResult: 20_000,
  beforeTyping: 1_000,
  tabLoad: 20_000,
  dialog: 30_000,
  fileFetch: 120_000,
  scrollRedraw: 10_000,
  scrollSettle: 1_500,
} as const;

export const MAX_DOCUMENTS = 10;

// Gmail's 25 MB limit applies after base64 encoding, which adds ~37% (a third plus line breaks).
export const ATTACHMENT_BUDGET_BYTES = 17 * 1024 * 1024;

export const MAX_CONSECUTIVE_FAILURES = 3;

// Typing too fast can leave the search text uncommitted, which makes the site open M00001.
export const TYPING_DELAY_MS = 50;

export const SEARCH = {
  landingText: 'Go Directly to Matter',
  boxPlaceholder: /eg M01234/i,
  noRecordsText: 'No Records Found',
} as const;

// FileMaker layout object numbers. On screen the Type and Category labels sit above each
// other's values; these map by meaning (type = "Capital Expenditure Approvals", category = "Water").
export const HEADER_FIELDS = {
  matterNumber: 286,
  status: 289,
  title: 290,
  type: 287,
  category: 298,
  dateReceived: 292,
  finalDate: 294,
  outcome: 295,
} as const;

export type HeaderField = keyof typeof HEADER_FIELDS;

// Header ids look like b0p0o290i0i0r1, where p0 is the header panel. The document list (p1)
// reuses some object numbers, so an unscoped `fm_object_N` class could match list elements.
export function headerFieldSelector(objectId: number): string {
  return `[id^="b0p0o${objectId}i"]`;
}

export const TAB_LABEL = new RegExp(`^(${DOC_TYPES.join('|')}) - (\\d+)$`);

export function tabButtonName(docType: DocType): RegExp {
  return new RegExp(`^${docType} - \\d+$`);
}

export const LIST = {
  row: 'tr.v-grid-row-has-data',
  viewport: '.v-grid-tablewrapper',
  // The grid scrolls through this separate scrollbar element, not a parent container.
  scroller: '.v-grid-scroller-vertical',
  goGetIt: /GO GET IT/i,
  saveList: /Save List/i,
  buttonLabels: /\b(Preview|GO GET IT)\b/g,
} as const;

export const DIALOGS = {
  window: '.v-window',
  exportTitle: 'Export Field to File',
  download: '.v-window.fm-modal-dialog',
  downloadButton: '.fm-download-button',
  ok: /^OK$/,
  close: /^Close$/,
  cancel: /^Cancel$/,
  downloadUrlMarker: '/dl/',
} as const;
