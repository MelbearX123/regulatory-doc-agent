import nodemailer, { type Transporter } from 'nodemailer';
import { getEmailConfig } from '../config';
import { logger } from '../logger';
import type { Reply } from '../types';
import { AGENT_NAME } from './compose';

const SMTP_PORT = 465;

export interface Threading {
  inReplyTo: string;
  references: string[];
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const { smtpHost, address, appPassword } = getEmailConfig();
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: SMTP_PORT,
      secure: true,
      auth: { user: address, pass: appPassword },
      // nodemailer's defaults allow minutes of waiting; the agent handles one email at a time, so fail fast.
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
    });
  }
  return transporter;
}

export async function sendReply(to: string, reply: Reply, threading?: Threading): Promise<void> {
  const { address } = getEmailConfig();
  const info = await getTransporter().sendMail({
    from: { name: AGENT_NAME, address },
    to,
    subject: reply.subject,
    text: reply.text,
    attachments: reply.attachment ? [{ filename: reply.attachment.fileName, path: reply.attachment.filePath }] : [],
    ...threading,
  });
  logger.info({ to, subject: reply.subject, messageId: info.messageId }, 'Reply sent');
}
