# Phase 5 plan: inbox listener (IMAP IDLE)

## Goal

Run the agent as a long-lived process (`npm run dev` locally, `npm start` when deployed) that notices new email within a couple of seconds (measured: about 2 s for delivered mail), answers every genuine request through the existing `replyToEmail()` pipeline, and stays up unattended for the review week.

Done looks like: send "Other Documents for M12205" to the agent's Gmail address and get a threaded reply with the ZIP a few seconds after the scrape finishes. Auto-replies, Google notifications and the agent's own mail are ignored without replying.

## Workflow

```
npm run dev / npm start → src/index.ts → startAgent()
        │
        ▼
connect to imap.gmail.com:993 (one connection), open INBOX
imapflow auto-IDLE: Gmail pushes "new mail" (exists event)
        │
   on start ─┐   exists event ─┐   every 5 min (backup) ─┐
             └─────────────────┴─────────────────────────┴──► sweep()
                                                                 │
   sweep(): if already running → set rerun flag and return      │
            else loop { claim unread → handle each } while rerun │
                                                                 ▼
   claimUnread(): lock INBOX → search UNSEEN → fetch raw source → mark \Seen (claim) → release lock
                                                                 │
                                                                 ▼ for each message, one at a time
   handleEmail()  (try/catch: one bad email is logged and skipped, never stops the loop)
     simpleParser(raw) → InboundEmail { messageId, from, subject, text, references, headers }
     shouldIgnore?  self │ no-reply / mailer-daemon │ Auto-Submitted │ Precedence bulk/list │ List-Id
                    │ yes → log "ignored", done (already marked read)
     rate limit?    more than 5 replies to this sender in the last hour → log, done
     stripQuotedReply(text)   (falls back to the full text if nothing is left)
     temp dir → replyToEmail({ subject, text }, dir)          [Phase 4 pipeline]
     sendReply(from, { ...reply, subject: "Re: …" }, { inReplyTo, references })
     finally: delete temp dir, log outcome + duration

   IMAP connection 'close' / 'error' → stop accepting work, finish the current email, exit(1)
                                       → the restart policy (Docker in Phase 6) starts a fresh process,
                                         whose startup sweep picks up anything missed
   SIGINT / SIGTERM → log out and exit (the email in progress, already marked read, gets no reply)
```

## What `agent.ts` will look like (~80 lines)

```ts
let running = false;
let rerun = false;

async function sweep(inbox: Inbox): Promise<void> {
  if (running) { rerun = true; return; }   // a trigger during a sweep queues exactly one re-run
  running = true;
  try {
    do {
      rerun = false;
      for (const message of await inbox.claimUnread()) await handleEmail(message);
    } while (rerun);
  } finally {
    running = false;
  }
}

export async function startAgent(): Promise<void> {
  const inbox = await connectInbox();
  inbox.onNewMail(() => void sweep(inbox));
  inbox.onClose(() => exitWhenIdle());               // crash-only: the restart policy brings us back
  setInterval(() => void sweep(inbox), sweepIntervalMs);
  await sweep(inbox);
}
```

No in-process reconnect: a dropped connection ends the process cleanly after the current email, and the restart policy plus the startup sweep cover recovery. That's one sentence for the video instead of a backoff state machine.

## Timeouts (nothing can freeze the serial loop)

| Step | Limit |
|---|---|
| Browser session (search, scrape, every file fetch) | Hard 3-minute deadline. A `setTimeout` closes the browser, which makes every pending Playwright call fail immediately, including the cookie-based file fetches, since they belong to the same browser context. `buildReply` turns that into the apology reply |
| Each Anthropic call | 20 s timeout, already in place (the SDK retries twice, so about 1 minute at worst), then the code fallback |
| Sending the reply | nodemailer connection / greeting / socket timeouts set to 30 s / 30 s / 60 s (the defaults allow up to 10 minutes) |
| IMAP commands | imapflow's socket timeout; a dead connection fires `close`, which ends the process as above |

## Files

### New

| File | Purpose |
|---|---|
| `src/email/inbound.ts` | Pure helpers, unit tested: `toInboundEmail(parsed)`, `shouldIgnore(email, agentAddress)`, `stripQuotedReply(text)`, `replySubject(subject, fallback)` |
| `src/email/inbox.ts` | The imapflow wrapper: `connectInbox()` returns `{ claimUnread, onNewMail, onClose, close }` |
| `src/rateLimit.ts` | `allowReply(sender, now)`: at most 5 replies per sender per rolling hour, in memory (~15 lines) |
| `src/agent.ts` | The loop above plus `handleEmail` |
| `src/index.ts` | Entry point: `startAgent()`, plus `unhandledRejection` / `uncaughtException` handlers that log and exit(1), so the restart policy can take over |

### Changed

| File | Change |
|---|---|
| `src/types.ts` | `InboundEmail` (extends `EmailContent` with `messageId`, `from`, `references`, `headers`) |
| `src/site/browser.ts`, `src/site/constants.ts` | The 3-minute browser deadline (fixes the earlier review item about requests having no overall time limit) |
| `src/email/send.ts` | nodemailer timeouts |
| `src/llm/parseRequest.ts` | Follow-up replies: the body wins over the subject. The prompt says the subject only fills gaps, and the fallback parser reads the body first and uses the subject only for missing parts. Example: subject "Re: M12205 – Other Documents" + body "now the Exhibits please" → M12205 / Exhibits |
| `src/config.ts`, `.env.example`, README | `POLL_INTERVAL_MS` (30 s) becomes `MAIL_SWEEP_INTERVAL_MS` (default 5 min) in all three places |
| `package.json` | `start` script for deployment |
| `README.md` | How the listener works, how to run it, status, limitations |

## Decisions

- **IMAP IDLE plus a 5-minute backup sweep.** Replies start within a couple of seconds, with almost no traffic while the inbox is quiet. The sweep catches anything a missed notification skipped. IDLE starts 1 s after the last command (imapflow's default is 15 s, during which new mail isn't pushed), and it's restarted every 4 minutes, which keeps the connection under imapflow's 5-minute socket timeout and Gmail's ~29-minute IDLE limit. A 7-minute silent gap was tested live.
- **Crash-only recovery.** imapflow doesn't reconnect by itself. Rather than write reconnect and backoff code, the process exits after finishing its current email, and the restart policy starts a fresh one. Hosting is Phase 6: Docker with `restart: unless-stopped` on a small always-on host, decided next. Locally, you just rerun `npm run dev`.
- **Claim before processing (at-most-once).** Messages are marked `\Seen` before any slow work. A crash loses at most one reply and never sends duplicates.
- **One email at a time.** Each request launches Chromium (around 300 MB) and takes 10–60 s, so serial processing keeps memory flat on a small host.
- **Reply to `From` only, never `Reply-To`.** Otherwise anyone could make the agent send ZIPs to a third party.
- **Loop protection in two layers.** Header rules catch well-behaved robots. The 5-per-hour-per-sender cap stops a badly behaved bot that sets no headers from ping-ponging forever.
- **Ignored mail is still marked read**, so it isn't looked at again on every sweep.
- **Quoted text is stripped before parsing.** A reply to our clarification email quotes ours, which contains the example "Other Documents from M12205". Stripping removes `>` lines, the "On … wrote:" line, and Outlook's "-----Original Message-----" block. Forwarded messages are kept as they are, because the forwarded part *is* the request. If stripping leaves nothing, the full text is used.
- **Threaded replies.** `Re: <original subject>`, or `Re: <our subject>` when the original is empty, plus `In-Reply-To` and `References`, so Gmail shows the reply under the request.
- **Shutdown is just "log out and exit".** Waiting up to 3 minutes for a request would clash with Docker's 10-second stop timeout, and the email in progress was already claimed.

## Edge cases

| Case | Handling |
|---|---|
| Agent's own mail, no-reply@, mailer-daemon@, auto-replies, mailing lists | Ignored (marked read, no reply) |
| A bot that sets no auto-reply headers | Capped at 5 replies per hour, then ignored |
| A malformed email (parser throws, no From) | Caught, logged, skipped; the loop continues |
| HTML-only email | mailparser converts it to text |
| Reply quoting our clarification email | Quoted part stripped first |
| "now the Exhibits please" in reply to our result email | Matter number from the subject, document type from the body |
| Site hangs | 3-minute browser deadline → apology reply |
| Gmail drops the connection | Finish the current email, exit, restart, startup sweep |
| Two emails at once / new mail during a sweep | Claimed together, handled one after another; one queued re-run |
| Sending fails | Logged; the email stays read |
| First start | The inbox currently holds 4 Google account emails and 3 self-sent test replies, all unread. Before the first run I'll list the unread mail read-only to confirm there's nothing else that would get a real reply |

## Testing

- **Unit (Vitest, no network):**
  - `shouldIgnore`: each rule.
  - `stripQuotedReply`: Gmail, Outlook, `>` quotes, forwarded mail, empty-result fallback.
  - `replySubject`: adds `Re:` once; handles an empty subject.
  - `allowReply`: the cap and the rolling window.
  - `toInboundEmail`: field mapping.
  - Follow-up parsing: subject + body, in the fallback parser.
  - The sweep: serial, one coalesced re-run, one failing email doesn't stop the rest. The inbox and pipeline are mocked.
- **End to end against the real inbox** (done by me, so you don't have to): a throwaway script, kept in the gitignored `spike/` folder and not in the repo, drops test emails into the inbox over IMAP from the agent's own plus-address (`agent+test@…`).
  - The agent processes them and replies to that plus-address.
  - Gmail delivers the reply back to the agent's inbox, where it's ignored as self-mail.
  - This exercises the whole loop, including threading and the loop guard, without emailing anyone else.
- **Your own check:** a few real emails from your personal Gmail before recording.

## Out of scope

- Several instances at once: deployment runs exactly one.
- A global sending cap beyond the per-sender one: Gmail's own limit of about 500 emails a day applies.

## Estimate

About 2 hours to build and test, plus review rounds.
