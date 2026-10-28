import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReply } from '../../src/agent/buildReply';
import { MatterNotFoundError, ScrapeError } from '../../src/core/errors';
import { fetchMatter } from '../../src/site/fetchMatter';
import { documentsResult } from '../fixtures';
import { DocType, ReplyKind } from '../../src/core/types';

vi.mock('../../src/site/fetchMatter', () => ({ fetchMatter: vi.fn() }));
const mockFetchMatter = vi.mocked(fetchMatter);

const request = { matterNumber: 'M12205', docType: DocType.KEY_DOCUMENTS };

describe('buildReply', () => {
  beforeEach(() => {
    mockFetchMatter.mockReset();
  });

  it('replies with the result when the fetch succeeds', async () => {
    mockFetchMatter.mockResolvedValue(documentsResult(DocType.KEY_DOCUMENTS, 6));
    const reply = await buildReply(request, '/downloads');
    expect(reply.kind).toBe(ReplyKind.RESULT);
    expect(mockFetchMatter).toHaveBeenCalledWith(request, '/downloads');
  });

  it('turns a missing matter into a not-found reply', async () => {
    mockFetchMatter.mockRejectedValue(new MatterNotFoundError('M12205'));
    expect((await buildReply(request, '/downloads')).kind).toBe(ReplyKind.NOT_FOUND);
  });

  it.each([new ScrapeError('Asked for M12205 but the site opened M00001'), new Error('browser crashed')])(
    'turns any other failure into an apology (%s)',
    async (error) => {
      mockFetchMatter.mockRejectedValue(error);
      expect((await buildReply(request, '/downloads')).kind).toBe(ReplyKind.ERROR);
    },
  );
});
