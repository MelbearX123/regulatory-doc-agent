# regulatory-doc-agent

An email agent that fetches documents from the [Nova Scotia Utility and Review Board public documents database](https://uarb.novascotia.ca/fmi/webd/UARB15).

Send it an email like:

> Hi Agent, can you give me Other Documents files from M12205? Thanks!

It replies with:

- a ZIP of up to 10 documents from the requested tab (for Recordings, which are ~300 MB audio files, the site's PDF list of recordings instead),
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
- **Virtualized document list.** The list is a Vaadin grid that keeps only a screenful of rows in the DOM and recycles them as you scroll. The downloader only clicks rows that are fully visible (clicking one below the fold makes the grid scroll mid-click, and a different document gets downloaded), remembers each row's text in a `Set` so nothing is fetched twice, then scrolls one screen minus a row and waits for the grid to redraw and settle before continuing. The browser window is tall enough that 10 rows fit without scrolling. As a safety net, a file whose ID (e.g. `102674` or `D-1`) isn't in the clicked row is rejected. It stops at 10 files, at the end of the list, or when the next file would exceed the attachment budget.
- **Downloads use the session-bound file URL, not the browser's download event.** Clicking a file opens a "Download Files" dialog (Transcripts and Recordings add an "Export Field to File" step first). The file button points a hidden iframe at a URL like `/fmi/webd/APP/connector/0/493/dl/102674.pdf`, which is fetched with the browser's cookies. Playwright's download event didn't fire for transcripts, so this single approach covers every tab.
- **Recordings are listed, not downloaded.** One hearing recording is about 326 MB, far over any email limit. The agent lists the first 10 recordings and attaches the site's own "Save List" PDF of the tab.
- **Header fields are read by FileMaker layout object number** (e.g. the id `b0p0o286…`, where `p0` is the header panel), not by position in the page text. The page text lists values and labels in different orders, and the on-screen "Type" and "Category" labels sit above each other's values. Dates are checked for the expected `MM/DD/YYYY` format and converted to ISO, so a layout change fails loudly instead of producing wrong data.
- **"Not found" vs "something broke" are separate errors.** A nonexistent matter makes the site show a "No Records Found" dialog, which becomes a `MatterNotFoundError`. Timeouts and unexpected pages become a `ScrapeError`.
- **Waits target specific content** (a tab label, the download dialog) rather than "page loaded" or "network idle", which never settle on this site.
- **Attachment budget of 17 MB.** Gmail's 25 MB limit applies after base64 encoding, which adds about 37% (a third, plus line breaks).
- **Every request gets a reply.** Fetch failures are turned into a reply rather than an exception: a "couldn't find that matter" reply for unknown matter numbers, and an apology for anything else. The reply text is built by plain code from the scraped facts, so it also works as the fallback if the LLM is unavailable.
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
| `LOG_LEVEL` / `LOG_PRETTY` | Log verbosity; `LOG_PRETTY=true` for readable local logs (needs dev dependencies), off by default for JSON lines |
| `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` | Inbox the agent reads and replies from |
| `POLL_INTERVAL_MS` | How often to check for new mail |
| `ANTHROPIC_API_KEY` / `LLM_MODEL` | LLM used for parsing and reply prose (default `claude-haiku-5-5`) |

## Usage

```bash
# Run the email agent (polls the inbox; not built yet, see Status)
npm run dev

# Fetch from the command line and print the reply that would be sent
npm run fetch -- M12205 "Other Documents"

# Same, but also email the reply (with the ZIP attached) to an address
npm run fetch -- M12205 "Other Documents" --send you@example.com

# Type-check
npm run typecheck
```

## Testing

```bash
npm test
```

Unit tests (Vitest) cover the logic that doesn't need a browser: matter number parsing, every variant of the reply email, tab-count and date parsing, the wrong-document check, file naming, zipping, turning fetch errors into replies, and the email handed to a mocked nodemailer. They run in under a second, make no network calls, and never read the real Gmail credentials. Scraping the live site is checked by hand with `npm run fetch`.

## Status

- [x] Project setup: config validation, logging
- [x] Scraper: search, matter verification, metadata, tab counts
- [x] Downloader and ZIP
- [x] Reply email (templated; LLM-written prose comes with request parsing)
- [ ] LLM request parsing
- [ ] Inbox polling loop
- [ ] Docker deployment

## Known limitations

- Downloads at most 10 documents per request: the first 10 as the site lists them. The site's sort order varies by tab (some newest first, some oldest first).
- Recordings are never downloaded; the reply lists them instead.
- The site sometimes files the same PDF under two document numbers; both copies end up in the ZIP.
- Rows are told apart by their text, so two rows with identical text count as one document.
- If the site opens the wrong matter (its silent `M00001` fallback), the agent replies with an apology rather than retrying.
- Requests are processed one at a time, so a burst of emails queues up.
- Depends on the site's current layout. If labels or structure change, selectors in `src/site/constants.ts` need updating.
- If the process crashes mid-request, that email gets no reply (by design, to avoid duplicates).
- No automated tests against the live site; the scraper is checked by running the CLI against real matters (existing, nonexistent, and malformed input).
