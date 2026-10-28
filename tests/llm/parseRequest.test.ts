import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocType, ExtractionIssue } from '../../src/core/types';
import { askForJson } from '../../src/llm/client';
import { checkExtraction, parseRequest, parseWithoutLlm } from '../../src/llm/parseRequest';

vi.mock('../../src/llm/client', () => ({ askForJson: vi.fn() }));
const mockAskForJson = vi.mocked(askForJson);

const EMAIL = 'Hi Agent, can you give me Other Documents files from M12205? Thanks!';
const OK_REQUEST = { ok: true, request: { matterNumber: 'M12205', docType: DocType.OTHER_DOCUMENTS } };

describe('checkExtraction', () => {
  it('accepts a matter number that appears in the email', () => {
    const extraction = { matterNumber: 'M12205', docType: DocType.OTHER_DOCUMENTS, issue: ExtractionIssue.NONE };
    expect(checkExtraction(extraction, EMAIL)).toEqual(OK_REQUEST);
  });

  it('normalizes the matter number', () => {
    const extraction = { matterNumber: 'm 12205', docType: DocType.OTHER_DOCUMENTS, issue: ExtractionIssue.NONE };
    expect(checkExtraction(extraction, 'other docs for m 12205')).toEqual(OK_REQUEST);
  });

  it('rejects a matter number that is not in the email', () => {
    const extraction = { matterNumber: 'M10431', docType: DocType.OTHER_DOCUMENTS, issue: ExtractionIssue.NONE };
    expect(checkExtraction(extraction, EMAIL)).toEqual({ ok: false, issue: ExtractionIssue.NO_MATTER_NUMBER });
  });

  it('asks for the document type when it is missing', () => {
    const extraction = { matterNumber: 'M12205', docType: null, issue: ExtractionIssue.NONE };
    expect(checkExtraction(extraction, EMAIL)).toEqual({ ok: false, issue: ExtractionIssue.NO_DOC_TYPE });
  });

  it('passes through an issue the LLM reported', () => {
    const extraction = { matterNumber: 'M12205', docType: null, issue: ExtractionIssue.MULTIPLE_REQUESTS };
    expect(checkExtraction(extraction, EMAIL)).toEqual({ ok: false, issue: ExtractionIssue.MULTIPLE_REQUESTS });
  });
});

describe('parseWithoutLlm', () => {
  it('finds an exact matter number and document type', () => {
    expect(parseWithoutLlm({ subject: '', text: EMAIL })).toEqual(OK_REQUEST);
  });

  it.each([
    ['no matter number', 'Other Documents please', ExtractionIssue.NO_MATTER_NUMBER],
    ['a misspelled document type', 'exibits for M12205', ExtractionIssue.NO_DOC_TYPE],
    ['two matters', 'Exhibits for M12205 and M10431', ExtractionIssue.MULTIPLE_REQUESTS],
    ['two document types', 'Exhibits and Transcripts for M12205', ExtractionIssue.MULTIPLE_REQUESTS],
  ])('reports %s', (_, text, issue) => {
    expect(parseWithoutLlm({ subject: '', text })).toEqual({ ok: false, issue });
  });

  it('fills in from the subject what the body leaves out', () => {
    expect(parseWithoutLlm({ subject: 'M12205', text: 'Other Documents please' })).toEqual(OK_REQUEST);
  });

  it('lets the body win over a follow-up subject', () => {
    const followUp = { subject: 'Re: M12205 – Other Documents', text: 'now the Exhibits please' };
    expect(parseWithoutLlm(followUp)).toEqual({
      ok: true,
      request: { matterNumber: 'M12205', docType: DocType.EXHIBITS },
    });
  });
});

describe('parseRequest', () => {
  beforeEach(() => {
    mockAskForJson.mockReset();
  });

  it('uses the LLM extraction', async () => {
    mockAskForJson.mockResolvedValue({ matterNumber: 'M12205', docType: DocType.EXHIBITS, issue: ExtractionIssue.NONE });
    const result = await parseRequest({ subject: '', text: 'can I get the exibits for M12205' });
    expect(result).toEqual({ ok: true, request: { matterNumber: 'M12205', docType: DocType.EXHIBITS } });
  });

  it('falls back to pattern matching when the LLM call fails', async () => {
    mockAskForJson.mockRejectedValue(new Error('network down'));
    expect(await parseRequest({ subject: '', text: EMAIL })).toEqual(OK_REQUEST);
  });

  it('reads the subject line too', async () => {
    mockAskForJson.mockRejectedValue(new Error('network down'));
    expect(await parseRequest({ subject: 'Other Documents for M12205', text: 'Thanks!' })).toEqual(OK_REQUEST);
  });
});
