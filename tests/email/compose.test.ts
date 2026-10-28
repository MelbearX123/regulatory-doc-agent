import { describe, expect, it } from 'vitest';
import { M12205_METADATA, documentsResult, savedFile, tabCounts } from '../fixtures';
import { DocType, ExtractionIssue, ReplyKind, StopReason, type ClarificationIssue, type FetchResult } from '../../src/core/types';
import {
  AGENT_NAME,
  composeClarificationReply,
  composeErrorReply,
  composeNotFoundReply,
  composeResultReply,
} from '../../src/email/compose';

const request = { matterNumber: 'M12205', docType: DocType.EXHIBITS };

function recordingsResult(listed: boolean): FetchResult {
  return {
    metadata: M12205_METADATA,
    tabCounts: tabCounts({ [DocType.RECORDINGS]: 23 }),
    request: { matterNumber: 'M12205', docType: DocType.RECORDINGS },
    download: null,
    recordings: { titles: ['09/12/2022 Monday', '09/13/2022 Tuesday'], listFile: listed ? savedFile('SoundList.pdf') : null },
    zip: null,
  };
}

describe('composeResultReply', () => {
  it('writes a greeting, the matter summary, the counts and a signature', () => {
    const reply = composeResultReply(documentsResult(DocType.OTHER_DOCUMENTS, 10));

    expect(reply.kind).toBe(ReplyKind.RESULT);
    expect(reply.subject).toBe('M12205 – Other Documents');
    expect(reply.text.startsWith('Hi,\n\n')).toBe(true);
    expect(reply.text.endsWith(`\n\n${AGENT_NAME}`)).toBe(true);
    expect(reply.text).toContain(`M12205 is about ${M12205_METADATA.title}.`);
    expect(reply.text).toContain('It is a Capital Expenditure Approvals matter in the Water category.');
    expect(reply.text).toContain('It was received on April 7, 2025, with a final date of October 23, 2025.');
    expect(reply.text).toContain('Status: Closed (outcome: Directions given).');
    expect(reply.text).toContain('I found 13 Exhibits, 6 Key Documents, 43 Other Documents, and no Transcripts or Recordings.');
  });

  it('attaches the ZIP', () => {
    const result = documentsResult(DocType.OTHER_DOCUMENTS, 10);
    expect(composeResultReply(result).attachment).toBe(result.zip);
  });

  it('says which part of a large tab was downloaded', () => {
    const { text } = composeResultReply(documentsResult(DocType.OTHER_DOCUMENTS, 10));
    expect(text).toContain(
      'I downloaded 10 of the 43 Other Documents (the first 10 as listed on the site) and attached them as a ZIP.',
    );
  });

  it('says "all" when the whole tab was downloaded', () => {
    const { text } = composeResultReply(documentsResult(DocType.KEY_DOCUMENTS, 6));
    expect(text).toContain('I downloaded all 6 Key Documents and attached them as a ZIP.');
  });

  it('uses the singular for a single document', () => {
    const result = documentsResult(DocType.KEY_DOCUMENTS, 1, { counts: { [DocType.KEY_DOCUMENTS]: 1 } });
    const { text } = composeResultReply(result);
    expect(text).toContain('1 Key Document,');
    expect(text).toContain('I downloaded the only Key Document and attached it as a ZIP.');
  });

  it('explains an empty tab and attaches nothing', () => {
    const result: FetchResult = { ...documentsResult(DocType.TRANSCRIPTS, 0), download: null };
    const reply = composeResultReply(result);
    expect(reply.text).toContain("There are no Transcripts in M12205, so there's nothing attached.");
    expect(reply.attachment).toBeNull();
  });

  it('explains when the size budget stopped the download', () => {
    const result = documentsResult(DocType.OTHER_DOCUMENTS, 8, { stopReason: StopReason.SIZE_BUDGET });
    const { text } = composeResultReply(result);
    expect(text).toContain('I downloaded 8 of the 43 Other Documents and attached them as a ZIP.');
    expect(text).toContain('I stopped there because more files would have exceeded the email size limit.');
  });

  it('explains when even the first file was too large', () => {
    const result = documentsResult(DocType.OTHER_DOCUMENTS, 0, { stopReason: StopReason.SIZE_BUDGET });
    const reply = composeResultReply(result);
    expect(reply.text).toContain('The first of the 43 Other Documents is too large to email, so nothing is attached.');
    expect(reply.attachment).toBeNull();
  });

  it.each([
    [1, "1 file couldn't be downloaded and was skipped."],
    [2, "2 files couldn't be downloaded and were skipped."],
  ])('mentions %i failed download(s)', (failedCount, sentence) => {
    const result = documentsResult(DocType.KEY_DOCUMENTS, 4, { failedCount, stopReason: StopReason.END_OF_LIST });
    expect(composeResultReply(result).text).toContain(sentence);
  });

  it('lists recordings and attaches the site list PDF', () => {
    const result = recordingsResult(true);
    const reply = composeResultReply(result);
    expect(reply.text).toContain('Here are the first 2 of 23:\n- 09/12/2022 Monday\n- 09/13/2022 Tuesday');
    expect(reply.text).toContain("I've attached the site's full list of recordings as a PDF.");
    expect(reply.attachment).toBe(result.recordings?.listFile);
  });

  it('points to the website when the recordings list PDF is missing', () => {
    const reply = composeResultReply(recordingsResult(false));
    expect(reply.text).toContain('The full list is available on the UARB website.');
    expect(reply.attachment).toBeNull();
  });

  it('skips metadata sentences for missing fields', () => {
    const result: FetchResult = {
      ...documentsResult(DocType.EXHIBITS, 1),
      metadata: { ...M12205_METADATA, type: null, finalDate: null, status: null },
    };
    const { text } = composeResultReply(result);
    expect(text).toContain('It is a Water matter.');
    expect(text).toContain('It was received on April 7, 2025.');
    expect(text).not.toContain('final date');
    expect(text).not.toContain('Status:');
  });

  it('uses "an" before a vowel', () => {
    const result: FetchResult = {
      ...documentsResult(DocType.EXHIBITS, 1),
      metadata: { ...M12205_METADATA, type: 'Amendment' },
    };
    expect(composeResultReply(result).text).toContain('It is an Amendment matter in the Water category.');
  });

  it('handles a matter with no documents at all', () => {
    const empty = tabCounts({
      [DocType.EXHIBITS]: 0,
      [DocType.KEY_DOCUMENTS]: 0,
      [DocType.OTHER_DOCUMENTS]: 0,
    });
    const result: FetchResult = { ...documentsResult(DocType.EXHIBITS, 0), tabCounts: empty, download: null };
    expect(composeResultReply(result).text).toContain('This matter has no documents in any tab.');
  });
});

describe('composeClarificationReply', () => {
  it.each<[ClarificationIssue, string]>([
    [ExtractionIssue.NO_MATTER_NUMBER, "I couldn't find a matter number in your email."],
    [ExtractionIssue.NO_DOC_TYPE, 'I can fetch Exhibits, Key Documents, Other Documents, Transcripts, or Recordings.'],
    [ExtractionIssue.MULTIPLE_REQUESTS, 'one matter and one document type per email'],
  ])('explains %s with an example request', (issue, sentence) => {
    const reply = composeClarificationReply(issue);
    expect(reply.kind).toBe(ReplyKind.CLARIFICATION);
    expect(reply.text).toContain(sentence);
    expect(reply.text).toContain('For example: "Can you send me the Other Documents from M12205?"');
    expect(reply.attachment).toBeNull();
  });
});

describe('composeNotFoundReply', () => {
  it('asks the sender to check the matter number', () => {
    const reply = composeNotFoundReply({ matterNumber: 'M99999', docType: DocType.EXHIBITS });
    expect(reply.kind).toBe(ReplyKind.NOT_FOUND);
    expect(reply.text).toContain("I couldn't find matter M99999");
    expect(reply.attachment).toBeNull();
  });
});

describe('composeErrorReply', () => {
  it('apologizes without attaching anything', () => {
    const reply = composeErrorReply(request);
    expect(reply.kind).toBe(ReplyKind.ERROR);
    expect(reply.text).toContain('Sorry, something went wrong on my end while fetching Exhibits for M12205.');
    expect(reply.attachment).toBeNull();
  });
});
