# Shrivastava Hub — Tenant Manager

Private family app for rent/tenant tracking and household expense tracking.
No auth — access control is "don't expose this publicly."

For architecture, domain concepts, and coding conventions (the stuff an
agent — or future you — needs before changing code), see [AGENTS.md](./AGENTS.md).
This README is the human quick-reference: how to actually get it running.

## Prerequisites

- Node.js
- **pnpm** — the only package manager used here. `package-lock.json` at the
  root is a stale leftover from `create-next-app`; ignore it.

## Running the app

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running the WhatsApp worker

Rent-reminder broadcasts and monthly greetings go out through a **separate**
service that isn't started by `pnpm dev` — you have to run it yourself:

```bash
cd whatsapp-worker
node index.js
```

It listens on `http://localhost:4005`. First time you start it (or after
clearing `whatsapp-worker/.wwebjs_auth`), it prints a **QR code to the
terminal** — scan it from WhatsApp on your phone (Linked Devices) to
authenticate. After that the session persists across restarts.

If you don't run this, the "Broadcast" and "Monthly greeting" buttons in the
tenant dashboard will fail with a 500 (the Next.js API can't reach
`localhost:4005`) — that's expected, not a bug.

**Away from the laptop**, use **Message on WhatsApp** on the tenant dashboard
instead (admin PIN). It needs no worker, so it works from the live site on
your phone: pick rent reminder or monthly greeting, then tap each tenant.
WhatsApp opens with the message already typed and you press send. The list
marks who you've opened so far.

The worker gets its message text from the app (`lib/whatsapp.ts`), so after
pulling a change to the wording, restart the worker as well as the app.

The Chrome executable path is hardcoded in `whatsapp-worker/index.js`
(`CHROME_PATH`, currently pointing at a specific `puppeteer`-managed Chrome
for Testing build). If Puppeteer's cached Chrome build changes version, update
that path.

## Environment variables

Copy/create `.env.local` at the repo root. Keys currently in use:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase client (`lib/supabase.ts`). Required for every DB call — the app throws at startup without these. |
| `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable keys (not currently used server-side, kept for reference/future use). |
| `NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS` | Set to `"true"` to show write-action buttons (mark rent paid, add/edit/delete expense, broadcast). Client-side gate only — see AGENTS.md. |
| `USER_PIN`, `ADMIN_PIN` | The two shared numeric PINs enforced server-side (`lib/admin-auth.ts`). Rotating `ADMIN_PIN` signs out every outstanding session of both tiers. |
| `GEMINI_API_KEY` | Powers **Scan slip**. Get one free at [aistudio.google.com](https://aistudio.google.com/apikey) — no card, no expiry. See the privacy note below. |
| `ANTHROPIC_API_KEY` | Alternative reader for **Scan slip**, used in preference to Gemini when set. Reads the handwriting better and does not train on inputs, but bills per call — a Claude Pro subscription does **not** include API credits. |
| `WHATSAPP_WORKER_URL` | Overrides the default `http://localhost:4005` for the WhatsApp worker. Only needed if the worker runs elsewhere. |
| `WA_TOKEN`, `NEXT_PUBLIC_API_SECRET`, `API_SECRET` | Present in `.env.local` but not currently wired into any route — legacy/reserved. |
| `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Leftover from the pre-Supabase Google Sheets era. No longer read by the app. |
| `POSTGRES_*` | Auto-populated by the Supabase/Vercel integration; not read directly (the app talks to Supabase via its JS client, not raw Postgres). |

## Scanning handwritten slips

The **Scan slip** button in the expense entry sheet reads a photographed slip
into draft rows you correct before saving. Set `GEMINI_API_KEY` to switch it
on; without a key it returns a clear error and the rest of the app is
unaffected.

The reader is told the day-first Indian date convention (`3.7.26` is 3 July)
and is handed your item catalogue, so it answers in your own Hinglish
spellings and the lines link back to existing items instead of starting
parallel histories. Nothing is written to the database from the photo — only
what you confirm on the review screen is saved.

On a phone, tap the camera button beside the `+` on the Expenses screen. If you
use this from a home-screen icon, you can also save `/expense?scan=1` as its
own icon, which opens straight to the camera.

Taking a photo does not read it straight away. If the page is written on both
sides, tap **Other side** and photograph the back too (up to four photos), then
**Read**. All the photos are read together as one slip, so a date written on
the front carries onto the back.

A photographed page is often a running list covering several days. Each line
keeps its own date, and the sheet groups them by day so a page spanning the end
of a month lands in both months rather than being flattened into one. If a date
comes out wrong, tap that day's heading to move all its lines, or the date under
a single line to move just that one. Typing a slip in by hand works the same way.

A read usually takes 10–30 seconds. Keep the app open while it runs.

**Two things to know before turning it on:**

- **Google's free tier may use what you send it to improve their products.**
  The paid tier and Vertex do not. Every slip you scan is a photo of household
  spending going to Google on those terms. If that is not acceptable, leave
  `GEMINI_API_KEY` unset and type entries in — the entry sheet is built to be
  fast without it.
- **Free-tier Gemini is a Flash model**, so it will misread some handwriting.
  That is why every line lands on a review screen, why uncertain ones are
  flagged, and why the slip's own total is checked against the lines. Read the
  draft before saving it; do not trust it blind.

## Database setup

Tenant/payment tables were migrated from Google Sheets and already exist in
Supabase. The expense-tracking tables are separate and need a one-time setup:

```bash
# Run scripts/expense-schema.sql once in the Supabase SQL editor
```

This creates `expense_categories`, `expense_items`, `expenses`, and seeds a
starter set of categories/items. Safe to re-run (uses `if not exists` /
`on conflict do nothing`).

## Testing

Backend-only test suite (Vitest) — see AGENTS.md for why there are no
frontend tests. `pnpm test` should always be fully green; a failure means a
real regression.

```bash
pnpm test            # run once
pnpm test:watch       # watch mode
pnpm test:coverage    # with coverage report
```

## Other scripts

```bash
pnpm build    # production build
pnpm start    # run a production build
pnpm lint     # eslint
```
