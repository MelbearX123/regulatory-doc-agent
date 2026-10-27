import {
  DOC_TYPES,
  ExtractionIssue,
  ReplyKind,
  StopReason,
  type ClarificationIssue,
  type DocType,
  type FetchResult,
  type MatterMetadata,
  type MatterRequest,
  type Reply,
  type TabCounts,
} from '../types';

export const AGENT_NAME = 'UARB Document Agent';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function composeResultReply(result: FetchResult): Reply {
  return {
    kind: ReplyKind.RESULT,
    subject: subjectFor(result.request),
    text: letter([describeMatter(result.metadata), describeCounts(result.tabCounts), ...describeFiles(result)]),
    attachment: result.zip ?? result.recordings?.listFile ?? null,
  };
}

export function composeNotFoundReply(request: MatterRequest): Reply {
  return {
    kind: ReplyKind.NOT_FOUND,
    subject: subjectFor(request),
    text: letter([
      `I couldn't find matter ${request.matterNumber} in the UARB public documents database. ` +
        'Could you double-check the number? Matter numbers are an M followed by 5 digits, for example M12205.',
    ]),
    attachment: null,
  };
}

export function composeErrorReply(request: MatterRequest): Reply {
  return {
    kind: ReplyKind.ERROR,
    subject: subjectFor(request),
    text: letter([
      `Sorry, something went wrong on my end while fetching ${request.docType} for ${request.matterNumber}. ` +
        'Please try again in a little while.',
    ]),
    attachment: null,
  };
}

const CLARIFICATIONS: Record<ClarificationIssue, string> = {
  [ExtractionIssue.NO_MATTER_NUMBER]:
    "I couldn't find a matter number in your email. Matter numbers are an M followed by 5 digits, for example M12205.",
  [ExtractionIssue.NO_DOC_TYPE]: `Which documents would you like? I can fetch ${joinList(DOC_TYPES, 'or')}.`,
  [ExtractionIssue.MULTIPLE_REQUESTS]:
    'I can handle one matter and one document type per email. Could you send each request separately?',
  [ExtractionIssue.NOT_A_REQUEST]:
    'I can send you documents from the UARB public database. Tell me a matter number and which documents ' +
    `you want: ${joinList(DOC_TYPES, 'or')}.`,
};

export function composeClarificationReply(issue: ClarificationIssue): Reply {
  return {
    kind: ReplyKind.CLARIFICATION,
    subject: 'Your document request',
    text: letter([
      CLARIFICATIONS[issue],
      'For example: "Can you send me the Other Documents from M12205?"',
    ]),
    attachment: null,
  };
}

function subjectFor({ matterNumber, docType }: MatterRequest): string {
  return `${matterNumber} – ${docType}`;
}

function letter(paragraphs: string[]): string {
  return ['Hi,', ...paragraphs, AGENT_NAME].join('\n\n');
}

function describeMatter(metadata: MatterMetadata): string {
  const { matterNumber, title, type, category, status, outcome, dateReceived, finalDate } = metadata;
  const sentences = [`${matterNumber} is about ${title}.`];

  const kind = type ?? category;
  if (type && category) sentences.push(`It is ${withArticle(type)} matter in the ${category} category.`);
  else if (kind) sentences.push(`It is ${withArticle(kind)} matter.`);

  if (dateReceived && finalDate) {
    sentences.push(`It was received on ${formatDate(dateReceived)}, with a final date of ${formatDate(finalDate)}.`);
  } else if (dateReceived) {
    sentences.push(`It was received on ${formatDate(dateReceived)}.`);
  }

  if (status && outcome) sentences.push(`Status: ${status} (outcome: ${outcome}).`);
  else if (status) sentences.push(`Status: ${status}.`);

  return sentences.join(' ');
}

function describeCounts(counts: TabCounts): string {
  const found = DOC_TYPES.filter((docType) => counts[docType] > 0).map((docType) => countOf(counts[docType], docType));
  const empty = DOC_TYPES.filter((docType) => counts[docType] === 0);
  if (found.length === 0) return 'This matter has no documents in any tab.';
  const parts = empty.length > 0 ? [...found, `no ${joinList(empty, 'or')}`] : found;
  return `I found ${joinList(parts, 'and')}.`;
}

function describeFiles(result: FetchResult): string[] {
  const { matterNumber, docType } = result.request;
  const total = result.tabCounts[docType];
  if (total === 0) return [`There are no ${docType} in ${matterNumber}, so there's nothing attached.`];

  if (result.recordings) {
    const { titles, listFile } = result.recordings;
    return [
      `Recordings are audio files of roughly 300 MB each, too large to email, so I haven't attached them. ` +
        `Here are the first ${titles.length} of ${total}:\n${titles.map((title) => `- ${title}`).join('\n')}`,
      listFile
        ? "I've attached the site's full list of recordings as a PDF."
        : 'The full list is available on the UARB website.',
    ];
  }

  if (!result.download) return [];
  const { documents, failedCount, stopReason } = result.download;
  const count = documents.length;
  const them = plural(count, 'it', 'them');
  const sentences: string[] = [];

  if (count === 0) {
    sentences.push(`The first of the ${countOf(total, docType)} is too large to email, so nothing is attached.`);
  } else if (count === total) {
    const all = total === 1 ? `the only ${singular(docType)}` : `all ${countOf(total, docType)}`;
    sentences.push(`I downloaded ${all} and attached ${them} as a ZIP.`);
  } else {
    const order = stopReason === StopReason.LIMIT ? ` (the first ${count} as listed on the site)` : '';
    sentences.push(`I downloaded ${count} of the ${countOf(total, docType)}${order} and attached ${them} as a ZIP.`);
  }
  if (stopReason === StopReason.SIZE_BUDGET && count > 0) {
    sentences.push('I stopped there because more files would have exceeded the email size limit.');
  }
  if (failedCount > 0) {
    const files = `${failedCount} ${plural(failedCount, 'file', 'files')}`;
    sentences.push(`${files} couldn't be downloaded and ${plural(failedCount, 'was', 'were')} skipped.`);
  }
  return [sentences.join(' ')];
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

function singular(docType: DocType): string {
  return docType.slice(0, -1);
}

function countOf(count: number, docType: DocType): string {
  return `${count} ${plural(count, singular(docType), docType)}`;
}

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

function joinList(items: readonly string[], conjunction: 'and' | 'or'): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`;
}
