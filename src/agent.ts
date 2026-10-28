import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { simpleParser } from 'mailparser';
import { getEmailConfig } from './config';
import { ignoreReason, replySubject, stripQuotedReply, threadingFor, toInboundEmail } from './email/inbound';
import { connectInbox } from './email/inbox';
import { sendReply } from './email/send';
import { logger } from './logger';
import { replyToEmail } from './pipeline';
import { createRateLimiter } from './rateLimit';

export interface Sweeper {
  sweep(): Promise<void>;
  idle(): Promise<void>;
}

// One sweep at a time: a trigger during a sweep queues exactly one more pass, so new mail is never missed.
export function createSweeper(claimUnread: () => Promise<Buffer[]>, handle: (raw: Buffer) => Promise<void>): Sweeper {
  let current: Promise<void> | null = null;
  let rerun = false;

  async function run(): Promise<void> {
    do {
      rerun = false;
      try {
        for (const raw of await claimUnread()) await handle(raw);
      } catch (err) {
        logger.error({ err }, 'Checking the inbox failed');
      }
    } while (rerun);
  }

  return {
    sweep() {
      if (current) {
        rerun = true;
        return current;
      }
      current = run().finally(() => {
        current = null;
      });
      return current;
    },
    idle: () => current ?? Promise.resolve(),
  };
}

// Never throws: one bad email is logged and skipped so it can't stop the emails after it.
export async function handleEmail(
  raw: Buffer,
  agentAddress: string,
  allowReply: (sender: string) => boolean,
): Promise<void> {
  const startedAt = Date.now();
  let workDir: string | null = null;
  try {
    const email = toInboundEmail(await simpleParser(raw));
    if (!email) {
      logger.warn('Skipping an email with no sender address');
      return;
    }
    const reason = ignoreReason(email, agentAddress);
    if (reason) {
      logger.info({ from: email.from, subject: email.subject, reason }, 'Ignoring email');
      return;
    }
    if (!allowReply(email.from)) {
      logger.warn({ from: email.from }, 'Sender is over the reply limit; ignoring email');
      return;
    }

    logger.info({ from: email.from, subject: email.subject }, 'Handling email');
    workDir = await mkdtemp(path.join(os.tmpdir(), 'uarb-agent-'));
    const reply = await replyToEmail({ subject: email.subject, text: stripQuotedReply(email.text) }, workDir);
    await sendReply(email.from, { ...reply, subject: replySubject(email.subject, reply.subject) }, threadingFor(email));
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    logger.info({ from: email.from, kind: reply.kind, seconds }, 'Replied');
  } catch (err) {
    logger.error({ err }, 'Handling an email failed; moving on');
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function startAgent(): Promise<void> {
  const { address, sweepIntervalMs } = getEmailConfig();
  const inbox = await connectInbox();
  const allowReply = createRateLimiter();
  const { sweep, idle } = createSweeper(
    () => inbox.claimUnread(),
    (raw) => handleEmail(raw, address, allowReply),
  );
  const backupSweep = setInterval(() => void sweep(), sweepIntervalMs);

  let exiting = false;
  async function exit(code: number, finishCurrentEmail: boolean): Promise<void> {
    if (exiting) return;
    exiting = true;
    clearInterval(backupSweep);
    if (finishCurrentEmail) await idle();
    await inbox.close().catch(() => undefined);
    process.exit(code);
  }

  // Crash-only recovery: imapflow doesn't reconnect, so a dropped connection ends the process after the
  // current email, and the restart policy starts a fresh one whose first sweep picks up anything missed.
  inbox.onClose(() => {
    logger.error('Inbox connection closed; exiting so the process can be restarted');
    void exit(1, true);
  });
  inbox.onNewMail(() => void sweep());
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      logger.info({ signal }, 'Shutting down');
      void exit(0, false);
    });
  }

  await sweep();
}
