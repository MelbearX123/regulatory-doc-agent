import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSweeper, handleEmail } from '../../src/agent/listener';
import { sendReply } from '../../src/email/send';
import { replyToEmail } from '../../src/agent/pipeline';
import { ReplyKind, type Reply } from '../../src/core/types';

vi.mock('../../src/agent/pipeline', () => ({ replyToEmail: vi.fn() }));
vi.mock('../../src/email/send', () => ({ sendReply: vi.fn() }));

const AGENT = 'agent@example.com';
const reply: Reply = { kind: ReplyKind.RESULT, subject: 'M12205 – Other Documents', text: 'Hi', attachment: null };

function raw(headers: string[], body = 'Other Documents for M12205'): Buffer {
  return Buffer.from([...headers, '', body].join('\r\n'));
}

const REQUEST = raw(['From: Person <person@example.com>', 'Subject: Documents', 'Message-ID: <req@example.com>']);

describe('createSweeper', () => {
  it('runs one sweep at a time and queues a single extra pass for triggers during it', async () => {
    let releaseFirst = (): void => undefined;
    const claimUnread = vi
      .fn<() => Promise<Buffer[]>>()
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = () => resolve([]))))
      .mockResolvedValue([]);
    const { sweep, idle } = createSweeper(claimUnread, vi.fn());

    void sweep();
    void sweep();
    void sweep();
    releaseFirst();
    await idle();

    expect(claimUnread).toHaveBeenCalledTimes(2);
  });

  it('handles every claimed email and survives a failing inbox check', async () => {
    const handle = vi.fn(async () => undefined);
    const claimUnread = vi
      .fn<() => Promise<Buffer[]>>()
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce([Buffer.from('a'), Buffer.from('b')]);
    const { sweep } = createSweeper(claimUnread, handle);

    await sweep();
    await sweep();

    expect(handle).toHaveBeenCalledTimes(2);
  });
});

describe('handleEmail', () => {
  beforeEach(() => {
    vi.mocked(replyToEmail).mockReset().mockResolvedValue(reply);
    vi.mocked(sendReply).mockReset();
  });

  it('replies to the sender in the same thread, after stripping quoted text', async () => {
    const quoted = raw(
      ['From: Person <person@example.com>', 'Subject: Re: M12205 – Other Documents', 'Message-ID: <req@example.com>'],
      'now the Exhibits please\n> For example: "Can you send me the Other Documents from M12205?"',
    );
    await handleEmail(quoted, AGENT, () => true);

    expect(replyToEmail).toHaveBeenCalledWith(
      { subject: 'Re: M12205 – Other Documents', text: 'now the Exhibits please' },
      expect.any(String),
    );
    expect(sendReply).toHaveBeenCalledWith(
      'person@example.com',
      { ...reply, subject: 'Re: M12205 – Other Documents' },
      { inReplyTo: '<req@example.com>', references: ['<req@example.com>'] },
    );
  });

  it('deletes its temporary folder afterwards', async () => {
    await handleEmail(REQUEST, AGENT, () => true);
    const workDir = vi.mocked(replyToEmail).mock.calls[0]?.[1];
    expect(workDir && existsSync(workDir)).toBe(false);
  });

  it.each([
    ['its own mail', raw(['From: agent@example.com', 'Subject: Re: Documents'])],
    ['automated mail', raw(['From: bot@example.com', 'Auto-Submitted: auto-replied'])],
    ['mail with no sender', raw(['Subject: no sender'])],
  ])('ignores %s', async (_, message) => {
    await handleEmail(message, AGENT, () => true);
    expect(replyToEmail).not.toHaveBeenCalled();
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('ignores a sender over the reply limit', async () => {
    await handleEmail(REQUEST, AGENT, () => false);
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('never throws, even when sending fails', async () => {
    vi.mocked(sendReply).mockRejectedValue(new Error('SMTP down'));
    await expect(handleEmail(REQUEST, AGENT, () => true)).resolves.toBeUndefined();
  });
});
