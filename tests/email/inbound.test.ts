import { simpleParser } from 'mailparser';
import { describe, expect, it } from 'vitest';
import { IgnoreReason, type InboundEmail } from '../../src/core/types';
import { ignoreReason, replySubject, stripQuotedReply, threadingFor, toInboundEmail } from '../../src/email/inbound';

const AGENT = 'Agent@Example.com';

async function parse(headers: string[], body = 'Other Documents for M12205'): Promise<InboundEmail | null> {
  return toInboundEmail(await simpleParser([...headers, '', body].join('\r\n')));
}

function email(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    from: 'person@example.com',
    subject: 'Request',
    text: 'Other Documents for M12205',
    messageId: '<req@example.com>',
    references: [],
    automated: false,
    ...overrides,
  };
}

describe('toInboundEmail', () => {
  it('maps a parsed email and lowercases the sender', async () => {
    const parsed = await parse([
      'From: Person <Person@Example.com>',
      'Subject: Documents please',
      'Message-ID: <req@example.com>',
      'References: <older@example.com>',
    ]);
    expect(parsed).toEqual({
      from: 'person@example.com',
      subject: 'Documents please',
      text: 'Other Documents for M12205',
      messageId: '<req@example.com>',
      references: ['<older@example.com>'],
      automated: false,
    });
  });

  it('returns null when there is no sender address', async () => {
    expect(await parse(['Subject: no sender'])).toBeNull();
  });

  it.each([
    ['Auto-Submitted: auto-replied'],
    ['Precedence: bulk'],
    ['List-Id: <news.example.com>'],
  ])('flags automated mail (%s)', async (header) => {
    expect((await parse(['From: bot@example.com', header]))?.automated).toBe(true);
  });

  it('does not flag Auto-Submitted: no', async () => {
    expect((await parse(['From: person@example.com', 'Auto-Submitted: no']))?.automated).toBe(false);
  });
});

describe('ignoreReason', () => {
  it('ignores the agent itself, whatever the case', () => {
    expect(ignoreReason(email({ from: 'agent@example.com' }), AGENT)).toBe(IgnoreReason.OWN_ADDRESS);
  });

  it('treats a +tag alias of the agent as a real sender', () => {
    expect(ignoreReason(email({ from: 'agent+test@example.com' }), AGENT)).toBeNull();
  });

  it.each(['no-reply@accounts.google.com', 'noreply@example.com', 'mailer-daemon@googlemail.com', 'postmaster@example.com'])(
    'ignores %s',
    (from) => {
      expect(ignoreReason(email({ from }), AGENT)).toBe(IgnoreReason.NO_REPLY_SENDER);
    },
  );

  it('ignores automated mail', () => {
    expect(ignoreReason(email({ automated: true }), AGENT)).toBe(IgnoreReason.AUTOMATED);
  });

  it('answers a normal person', () => {
    expect(ignoreReason(email(), AGENT)).toBeNull();
  });
});

describe('stripQuotedReply', () => {
  it('drops a Gmail-style quote', () => {
    const text = [
      'Exhibits please',
      '',
      'On Mon, Oct 27, 2026 at 3:12 PM UARB Document Agent <agent@example.com> wrote:',
      '> For example: "Can you send me the Other Documents from M12205?"',
    ].join('\n');
    expect(stripQuotedReply(text)).toBe('Exhibits please');
  });

  it('drops an Outlook-style original message', () => {
    const text = ['M10431 transcripts', '', 'From: UARB Document Agent', 'Sent: Monday', 'Other Documents from M12205'].join(
      '\n',
    );
    expect(stripQuotedReply(text)).toBe('M10431 transcripts');
  });

  it('keeps a request written below the quote', () => {
    expect(stripQuotedReply('> quoted line\nKey Documents for M12205')).toBe('Key Documents for M12205');
  });

  it('keeps forwarded mail', () => {
    const text = '---------- Forwarded message ---------\nExhibits for M12205';
    expect(stripQuotedReply(text)).toBe(text);
  });

  it('falls back to the full text when everything is quoted', () => {
    expect(stripQuotedReply('> Exhibits for M12205')).toBe('> Exhibits for M12205');
  });
});

describe('replySubject', () => {
  it('adds "Re:" once', () => {
    expect(replySubject('Documents please', 'fallback')).toBe('Re: Documents please');
    expect(replySubject('RE: Documents please', 'fallback')).toBe('RE: Documents please');
  });

  it('uses the fallback when the subject is empty', () => {
    expect(replySubject('  ', 'M12205 – Exhibits')).toBe('Re: M12205 – Exhibits');
  });
});

describe('threadingFor', () => {
  it('replies to the message and extends its references', () => {
    expect(threadingFor(email({ references: ['<older@example.com>'] }))).toEqual({
      inReplyTo: '<req@example.com>',
      references: ['<older@example.com>', '<req@example.com>'],
    });
  });

  it('returns nothing without a message id', () => {
    expect(threadingFor(email({ messageId: null }))).toBeUndefined();
  });
});
