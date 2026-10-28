import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReply } from '../../src/agent/buildReply';
import { composeResultReply } from '../../src/email/compose';
import { parseRequest } from '../../src/llm/parseRequest';
import { polishReply } from '../../src/llm/polishReply';
import { replyToEmail } from '../../src/agent/pipeline';
import { documentsResult } from '../fixtures';
import { DocType, ExtractionIssue, ReplyKind } from '../../src/core/types';

vi.mock('../../src/llm/parseRequest', () => ({ parseRequest: vi.fn() }));
vi.mock('../../src/agent/buildReply', () => ({ buildReply: vi.fn() }));
vi.mock('../../src/llm/polishReply', () => ({ polishReply: vi.fn((reply: unknown) => reply) }));

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
