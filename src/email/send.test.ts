import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedFile } from '../testFixtures';
import { ReplyKind, type Reply } from '../types';
import { sendReply } from './send';

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock('nodemailer', () => ({ default: { createTransport } }));

const reply: Reply = {
  kind: ReplyKind.RESULT,
  subject: 'M12205 – Key Documents',
  text: 'Hi,\n\nBody',
  attachment: savedFile('M12205-key-documents.zip'),
};

describe('sendReply', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: '<id@example.com>' });
  });

  it('sends from the agent over Gmail SMTP with the attachment', async () => {
    await sendReply('person@example.com', reply);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'agent@example.com', pass: 'test-password' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'UARB Document Agent', address: 'agent@example.com' },
      to: 'person@example.com',
      subject: reply.subject,
      text: reply.text,
      attachments: [{ filename: 'M12205-key-documents.zip', path: '/downloads/M12205-key-documents.zip' }],
    });
  });

  it('sends no attachments when the reply has none', async () => {
    await sendReply('person@example.com', { ...reply, attachment: null });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ attachments: [] }));
  });

  it('adds threading headers so the reply joins the original thread', async () => {
    await sendReply('person@example.com', reply, { inReplyTo: '<req@example.com>', references: ['<req@example.com>'] });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ inReplyTo: '<req@example.com>', references: ['<req@example.com>'] }),
    );
  });

  it('reuses one SMTP connection across sends', async () => {
    vi.resetModules();
    createTransport.mockClear();
    const { sendReply: freshSendReply } = await import('./send');

    await freshSendReply('a@example.com', reply);
    await freshSendReply('b@example.com', reply);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
