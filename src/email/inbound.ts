import type { ParsedMail } from 'mailparser';
import { IgnoreReason, type InboundEmail } from '../types';
import type { Threading } from './send';

const NO_REPLY_SENDER = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster)\b/i;
const QUOTE_HEADER = /^On .+ wrote:$/;
const QUOTED_ORIGINAL_START = [/^-{2,}\s*Original Message\s*-{2,}$/i, /^_{10,}$/];

export function toInboundEmail(parsed: ParsedMail): InboundEmail | null {
  const from = parsed.from?.value[0]?.address?.toLowerCase();
  if (!from) return null;
  return {
    from,
    subject: parsed.subject ?? '',
    text: parsed.text ?? '',
    messageId: parsed.messageId ?? null,
    references: [parsed.references ?? []].flat(),
    automated: isAutomated(parsed),
  };
}

// The agent's own address must match exactly: mail from a +tag alias of it is a real sender.
export function ignoreReason(email: InboundEmail, agentAddress: string): IgnoreReason | null {
  if (email.from === agentAddress.toLowerCase()) return IgnoreReason.OWN_ADDRESS;
  if (NO_REPLY_SENDER.test(email.from)) return IgnoreReason.NO_REPLY_SENDER;
  if (email.automated) return IgnoreReason.AUTOMATED;
  return null;
}

// Replies quote our earlier email, whose example request ("Other Documents from M12205") would otherwise
// be read as the new request. Forwarded mail is kept: the forwarded part is the request.
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const originalStart = lines.findIndex(
    (line, i) =>
      QUOTED_ORIGINAL_START.some((pattern) => pattern.test(line.trim())) ||
      (line.startsWith('From:') && (lines[i + 1] ?? '').startsWith('Sent:')),
  );
  const ownLines = (originalStart === -1 ? lines : lines.slice(0, originalStart)).filter(
    (line) => !line.trimStart().startsWith('>') && !QUOTE_HEADER.test(line.trim()),
  );
  return ownLines.join('\n').trim() || text.trim();
}

export function replySubject(subject: string, fallback: string): string {
  const base = subject.trim() || fallback;
  return /^re:/i.test(base) ? base : `Re: ${base}`;
}

export function threadingFor(email: InboundEmail): Threading | undefined {
  if (!email.messageId) return undefined;
  return { inReplyTo: email.messageId, references: [...email.references, email.messageId] };
}

function isAutomated(parsed: ParsedMail): boolean {
  const header = (name: string): string => {
    const value = parsed.headers.get(name);
    return typeof value === 'string' ? value.toLowerCase() : '';
  };
  const autoSubmitted = header('auto-submitted');
  return (
    (autoSubmitted !== '' && autoSubmitted !== 'no') ||
    ['bulk', 'list', 'junk'].includes(header('precedence')) ||
    parsed.headers.has('list-id') ||
    parsed.headers.has('list')
  );
}
