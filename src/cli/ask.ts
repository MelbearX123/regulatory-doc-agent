import { parseArgs } from 'node:util';
import { replyToEmail } from '../pipeline';
import type { EmailContent } from '../types';
import { finishWithReply, freshDownloadDir, isEmailAddress } from './common';

const USAGE = [
  'Usage: npm run ask -- "<email text>" [--send <email address>]',
  '  e.g. npm run ask -- "Can you send me the Other Documents from M12205?"',
].join('\n');

interface CliArgs {
  email: EmailContent;
  sendTo: string | undefined;
}

function parseCliArgs(): CliArgs | null {
  let text: string | undefined;
  let sendTo: string | undefined;
  try {
    const parsed = parseArgs({ allowPositionals: true, options: { send: { type: 'string' } } });
    [text] = parsed.positionals;
    sendTo = parsed.values.send;
  } catch (err) {
    console.error(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    return null;
  }

  const validRecipient = sendTo === undefined || isEmailAddress(sendTo);
  if (!text || !validRecipient) {
    if (!validRecipient) console.error(`"${sendTo}" is not an email address.`);
    console.error(USAGE);
    return null;
  }
  return { email: { subject: '', text }, sendTo };
}

async function main(): Promise<number> {
  const args = parseCliArgs();
  if (!args) return 1;
  const outputDir = await freshDownloadDir('ask');
  return finishWithReply(await replyToEmail(args.email, outputDir), args.sendTo);
}

// exitCode instead of process.exit() so pino can flush its last log lines.
process.exitCode = await main();
