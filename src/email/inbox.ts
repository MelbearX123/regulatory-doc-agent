import { ImapFlow } from 'imapflow';
import { getEmailConfig } from '../config';
import { logger } from '../logger';

const IMAP_PORT = 993;
const MAILBOX = 'INBOX';
// imapflow waits 15 s after the last command before it starts IDLE, and mail arriving in that gap
// isn't pushed; 1 s keeps replies prompt.
const AUTO_IDLE_DELAY_MS = 1000;
// Restarting IDLE every few minutes keeps the connection from going silent long enough for imapflow's
// 5-minute socket timeout (or Gmail's ~29-minute IDLE limit) to drop it.
const MAX_IDLE_MS = 4 * 60 * 1000;

export interface Inbox {
  claimUnread(): Promise<Buffer[]>;
  onNewMail(listener: () => void): void;
  onClose(listener: () => void): void;
  close(): Promise<void>;
}

// One connection, kept open on INBOX; imapflow IDLEs on it automatically, so Gmail pushes new-mail events.
export async function connectInbox(): Promise<Inbox> {
  const { imapHost, address, appPassword } = getEmailConfig();
  const client = new ImapFlow({
    host: imapHost,
    port: IMAP_PORT,
    secure: true,
    auth: { user: address, pass: appPassword },
    autoIdleDelay: AUTO_IDLE_DELAY_MS,
    maxIdleTime: MAX_IDLE_MS,
    logger: false,
  });
  // Without an 'error' listener, Node turns a dropped connection into an uncaught exception.
  client.on('error', (err: Error) => logger.warn({ err }, 'IMAP connection error'));
  await client.connect();
  await client.mailboxOpen(MAILBOX);
  logger.info({ mailbox: MAILBOX }, 'Watching the inbox');

  return {
    // Marks the messages read before returning them: a crash afterwards loses a reply but never duplicates one.
    async claimUnread() {
      const lock = await client.getMailboxLock(MAILBOX);
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        if (uids.length === 0) return [];
        const sources: Buffer[] = [];
        for await (const message of client.fetch(uids, { source: true }, { uid: true })) {
          if (message.source) sources.push(message.source);
        }
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
        return sources;
      } finally {
        lock.release();
      }
    },
    onNewMail: (listener) => void client.on('exists', listener),
    onClose: (listener) => void client.on('close', listener),
    close: () => client.logout(),
  };
}
