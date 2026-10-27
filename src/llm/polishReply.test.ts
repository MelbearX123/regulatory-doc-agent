import { beforeEach, describe, expect, it, vi } from 'vitest';
import { composeNotFoundReply, composeResultReply } from '../email/compose';
import { documentsResult } from '../testFixtures';
import { DocType } from '../types';
import { askForJson } from './client';
import { polishReply, sameFacts } from './polishReply';

vi.mock('./client', () => ({ askForJson: vi.fn() }));
const mockAskForJson = vi.mocked(askForJson);

const template = composeResultReply(documentsResult(DocType.OTHER_DOCUMENTS, 10));

describe('sameFacts', () => {
  it('accepts reworded text with the same numbers', () => {
    expect(sameFacts('I found 13 Exhibits and 6 Key Documents.', 'There are 6 Key Documents and 13 Exhibits.')).toBe(true);
  });

  it.each([
    ['a changed number', 'I found 14 Exhibits and 6 Key Documents.'],
    ['an added number', 'I found 13 Exhibits and 6 Key Documents in 2025.'],
    ['a dropped number', 'I found 13 Exhibits.'],
  ])('rejects %s', (_, rewritten) => {
    expect(sameFacts('I found 13 Exhibits and 6 Key Documents.', rewritten)).toBe(false);
  });
});

describe('polishReply', () => {
  beforeEach(() => {
    mockAskForJson.mockReset();
  });

  it('uses the rewrite when the facts are unchanged', async () => {
    const rewritten = template.text.replace('Hi,', 'Hello there,');
    mockAskForJson.mockResolvedValue({ body: rewritten });
    expect((await polishReply(template)).text).toBe(rewritten);
  });

  it('keeps the template when the rewrite changes a fact', async () => {
    mockAskForJson.mockResolvedValue({ body: template.text.replace('43', '44') });
    expect(await polishReply(template)).toBe(template);
  });

  it('keeps the template when the LLM call fails', async () => {
    mockAskForJson.mockRejectedValue(new Error('network down'));
    expect(await polishReply(template)).toBe(template);
  });

  it('leaves replies other than results alone', async () => {
    const notFound = composeNotFoundReply({ matterNumber: 'M99999', docType: DocType.EXHIBITS });
    expect(await polishReply(notFound)).toBe(notFound);
    expect(mockAskForJson).not.toHaveBeenCalled();
  });
});
