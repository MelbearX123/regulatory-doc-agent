# regulatory-doc-agent

An email agent that fetches documents from the [Nova Scotia Utility and Review Board public documents database](https://uarb.novascotia.ca/fmi/webd/UARB15).

Send it an email like:

> Hi Agent, can you give me Other Documents files from M12205? Thanks!

It replies with:

- a ZIP of up to 10 documents from the requested tab,
- a short summary of the matter (title, type, category, dates, status, outcome),
- the number of documents in each tab, and how many of the requested tab's documents were downloaded.

Supported document types: **Exhibits, Key Documents, Other Documents, Transcripts, Recordings**. Matter numbers look like `M` followed by 5 digits (e.g. `M12205`).

## How it works

```
IMAP poll ─► parse request (LLM) ─► search + download (Playwright) ─► ZIP ─► write reply (LLM + template) ─► SMTP
                 │ unclear request                    │ failure
                 └──► asks for clarification          └──► apologetic error reply
```

1. **Read email.** A Gmail inbox is polled over IMAP. Unread messages are claimed (marked read) and handled one at a time.
2. **Parse the request.** An LLM turns the free-form email into `{ matterNumber, docType }`. The output is validated with zod, and the matter number must also appear in the original email text. If something is missing or ambiguous, the agent replies asking for clarification.
3. **Fetch documents.** Playwright drives a headless Chromium through the site: search the matter, confirm the right matter opened, read the metadata and tab counts, open the requested tab, and download up to 10 files.
4. **ZIP.** Files are zipped while staying under Gmail's attachment limit; anything left out is mentioned in the reply.
5. **Reply.** Code fills in all facts (title, dates, counts). The LLM only writes the connective prose around them, so it can't introduce numbers that weren't scraped.

## Design decisions

- **Deterministic scraping, LLM only at the edges.** The LLM handles the fuzzy parts (understanding the email, writing friendly prose). The browser steps are plain code, not an LLM deciding where to click. That makes them faster, cheaper, and repeatable.
- **A real browser is required.** The site is a FileMaker WebDirect (Vaadin) app that talks to its server over a push channel. There's no JSON API to call directly.
- **Verify the matter number.** If a search isn't committed properly, the site silently opens matter `M00001`. The scraper always checks that the matter shown matches the one requested (after normalizing case, spaces, and a missing `M`) and fails loudly otherwise.
- **Virtualized document list.** Only about 9 rows exist in the DOM at once. The downloader processes the visible rows, de-duplicates by document number, scrolls, and repeats.
- **Waits target specific content** (a tab label, the download dialog) rather than "page loaded" or "network idle", which never settle on this site.
- **Attachment budget of about 18 MB.** Gmail's 25 MB limit applies after base64 encoding, which adds roughly a third.
- **At-most-once processing.** Emails are marked read when claimed, so a crash can't cause duplicate replies. The agent ignores mail from itself and from auto-responders to avoid reply loops.
- **Site-specific selectors live in one file** (`src/site/constants.ts`), so a site change means one place to fix.

## Setup

Requirements: Node.js 22+ and a Gmail account with 2-step verification and an [app password](https://myaccount.google.com/apppasswords).

```bash
npm install
npx playwright install chromium
cp .env.example .env   # then fill in the values
```

| Variable | Purpose |
|---|---|
| `HEADLESS` | `false` to watch the browser while debugging |
| `LOG_LEVEL` / `LOG_PRETTY` | Log verbosity; pretty output locally, JSON lines in production |
| `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` | Inbox the agent reads and replies from |
| `POLL_INTERVAL_MS` | How often to check for new mail |
| `ANTHROPIC_API_KEY` / `LLM_MODEL` | LLM used for parsing and reply prose (default `claude-haiku-5-5`) |

## Usage

```bash
# Run the email agent (polls the inbox)
npm run dev

# Fetch from the command line: matter number + document type
npm run fetch -- M12205 "Other Documents"

# Type-check
npm run typecheck
```

## Status

- [x] Project setup: config validation, logging
- [ ] Scraper: search, matter verification, metadata, tab counts
- [ ] Downloader and ZIP
- [ ] Reply email
- [ ] LLM request parsing
- [ ] Inbox polling loop
- [ ] Docker deployment

## Known limitations

- Downloads at most 10 documents per request; large recordings may be left out to fit the attachment limit.
- Requests are processed one at a time, so a burst of emails queues up.
- Depends on the site's current layout. If labels or structure change, selectors in `src/site/constants.ts` need updating.
- If the process crashes mid-request, that email gets no reply (by design, to avoid duplicates).
