import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReply } from './buildReply';
import { composeResultReply } from './email/compose';
import { parseRequest } from './llm/parseRequest';
import { polishReply } from './llm/polishReply';
import { replyToEmail } from './pipeline';
import { documentsResult } from './testFixtures';
import { DocType, ExtractionIssue, ReplyKind } from './types';

vi.mock('./llm/parseRequest', () => ({ parseRequest: vi.fn() }));
vi.mock('./buildReply', () => ({ buildReply: vi.fn() }));
vi.mock('./llm/polishReply', () => ({ polishReply: vi.fn((reply: unknown) => reply) }));

const email = { subject: '', text: 'Other Documents from M12205' };
const request = { matterNumber: 'M12205', docType: DocType.OTHER_DOCUMENTS };

describe('replyToEmail', () => {
  beforeEach(() => {
    vi.mocked(buildReply).mockReset();
  });

  it('asks for clarification without fetching when the request is unclear', async () => {
    vi.mocked(parseRequest).mockResolvedValue({ ok: false, issue: ExtractionIssue.NO_DOC_TYPE });
    const reply = await replyToEmail(email, '/downloads');
    expect(reply.kind).toBe(ReplyKind.CLARIFICATION);
    expect(buildReply).not.toHaveBeenCalled();
  });

  it('fetches, then polishes the reply', async () => {
    const result = composeResultReply(documentsResult(DocType.OTHER_DOCUMENTS, 10));
    vi.mocked(parseRequest).mockResolvedValue({ ok: true, request });
    vi.mocked(buildReply).mockResolvedValue(result);

    expect(await replyToEmail(email, '/downloads')).toBe(result);
    expect(buildReply).toHaveBeenCalledWith(request, '/downloads');
    expect(polishReply).toHaveBeenCalledWith(result);
  });
});
