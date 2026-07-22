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
| `WHATSAPP_WORKER_URL` | Overrides the default `http://localhost:4005` for the WhatsApp worker. Only needed if the worker runs elsewhere. |
| `WA_TOKEN`, `NEXT_PUBLIC_API_SECRET`, `API_SECRET` | Present in `.env.local` but not currently wired into any route — legacy/reserved. |
| `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Leftover from the pre-Supabase Google Sheets era. No longer read by the app. |
| `POSTGRES_*` | Auto-populated by the Supabase/Vercel integration; not read directly (the app talks to Supabase via its JS client, not raw Postgres). |

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
