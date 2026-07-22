<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo context for coding agents

This is a **private single-family app** ("Shrivastava Hub") — no public users,
no login/auth system anywhere. The people using it are the repo owner and a
few relatives, including a non-technical grandmother. Keep that in mind before
suggesting auth, rate-limiting, multi-tenancy, or other SaaS-shaped concerns —
they're usually not warranted here unless explicitly requested.

## What this app does

A Next.js App Router app (`/`) that hubs into a few sub-apps via
`components/Hub.tsx`. Only two are actually implemented today:

- **`/tenant`** — rent tracking: tenants, monthly rent calculation (with
  scheduled increases), payment status (paid/late/pending), payment history,
  WhatsApp rent-reminder broadcasts.
- **`/expense`** — household expense tracking: log expenses against a
  catalog of items/categories, monthly summaries with category breakdowns.

The other Hub tiles (Accounts, Family, Properties, Documents) are placeholders
— no routes exist for them yet. Don't assume they're implemented.

Data used to live in Google Sheets (see `maxsash-tenant-management-*.json`,
a service-account credential file, now vestigial) and was migrated to
**Supabase** (see commit `b649b0b`). Some domain logic still carries
migration-era assumptions — see "Known deferred bugs" below.

## Architecture: backend-only business logic

**All business logic lives in `lib/**` or `app/api/**`. Components
(`components/**`, `app/**/page.tsx`) are fetch-and-render only** — they call
`/api/*` routes and display the result, with at most light client-side UX
checks (e.g. "is this field non-empty before I bother submitting"). This is a
deliberate, actively-enforced rule, not an accident of how the code grew —
see the `09d5d97` refactor commit, which relocated ~10 pieces of logic
(date defaults, expense classification, percentage math, admin gating) out of
components and into `lib/`.

When adding a feature: figure out the computation/validation/derivation
first, put it in `lib/` (pure, unit-testable) or inline in the route handler,
and give the component only the already-computed result to render. If you
find yourself writing `Math.round(...)`, a `.filter()`/`.map()` deriving a
new field, or a conditional that decides *what counts as* something (active,
paid, in-stock, etc.) inside a `components/**` file, that logic almost
certainly belongs server-side instead.

### No server-side authorization (intentional)

Write actions (mark rent paid, add/edit/delete expense, broadcast) are gated
**only** by a client-side env flag, `NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS ===
"true"`, checked via `lib/config.ts#isAdminActionsEnabled()`. This just
hides/shows buttons in the UI. The API routes themselves
(`app/api/mark-paid`, `app/api/expenses/*`, `app/api/expense-items/*`,
`app/api/expense-categories/*`) have **no server-side auth check** — this is
a known, accepted gap for a private family app, not an oversight. Mirror this
pattern for new write-capable modules rather than introducing real auth
unless asked.

## Directory map

```
app/api/**/route.ts        Route handlers — the only place allowed to talk
                            to lib/db.ts / Supabase directly from a request.
app/{tenant,expense}/       Page shells, just render the top-level component.
components/tenants/**       Rent/tenant UI (fetch-and-render only).
components/expenses/**      Expense UI (fetch-and-render only).
lib/                        All business logic. See below.
services/                   Client-side data-fetching helpers used by
                            components (thin wrappers around fetch("/api/...")).
types/                      Shared TS types for Tenant/Payment/Expense/etc.
test/                       Vitest fixtures, Supabase mocks, hang-repro harness.
scripts/expense-schema.sql  One-time Supabase SQL setup for the expense tables.
whatsapp-worker/            Separate Node/Express service, NOT part of the
                            Next.js app — see below.
```

### `lib/` modules

- `lib/rent.ts` — `getRentMonth`/`getPaymentMonth` (month conversion — see
  "Rent month vs payment month" below), `calculateRent` (applies scheduled
  increases), `getIncreaseDisplay` (formats an increase for display).
- `lib/payment-status.ts` — `evaluatePaymentStatus` (single source of truth
  for paid/late/pending; on-time cutoff is day 7 of the payment month by
  default), `buildPaymentHistory`.
- `lib/tenant.ts` — `getActiveTenants` (filters to tenants active in a given
  month; wraps the not-exported `isActiveTenant`).
- `lib/db.ts` — all Supabase reads/writes. Every DB access in the app goes
  through here; nothing outside `lib/db.ts` should call `lib/supabase.ts`
  directly except `lib/db.ts` itself.
- `lib/expenses.ts` — `deriveExpenseFields` (pick/custom/lump-sum expense
  classification logic).
- `lib/expense-summary.ts`, `lib/expense-categories.ts` — expense aggregation
  and category/item grouping helpers.
- `lib/config.ts` — `isAdminActionsEnabled()`.
- `lib/date.ts` — `currentMonth()`/`currentDate()`, single-sourced so routes
  and components agree on "today."

### Domain concepts worth knowing before touching rent/payment code

- **Rent month vs payment month**: rent for month `M` is due (paid) in month
  `M+1`. `payments.month` in the DB stores the **payment month**, not the
  rent month. `getRentMonth(paymentMonth)` and `getPaymentMonth(rentMonth)`
  in `lib/rent.ts` are the only converters — don't reimplement this
  conversion inline.
- **Payment status** is always evaluated through
  `lib/payment-status.ts#evaluatePaymentStatus` — don't reimplement
  paid/late/pending logic elsewhere.
- **`GLOBAL_CUTOFF = "2023-12"`** (`app/api/tenant-payments/[id]/route.ts`) —
  the earliest month the app will ever generate payment-history rows for,
  regardless of how far back `tenant_since` goes (predates reliable data).
- **`active` on a tenant** is a plain `boolean` (`types/tenant.ts`), matching
  the current Supabase column. It used to be free text left over from the
  pre-migration Google Sheets era (`"true"`/`"yes"`/`"y"` in any casing,
  handled by an `isActiveTenant` helper in `lib/tenant.ts`); that legacy
  fallback was deliberately removed — this app targets the current Supabase
  schema only, not historical data shapes. `getActiveTenants` now reads
  `tenant.active` directly as a boolean, no coercion.

## whatsapp-worker (separate service)

`whatsapp-worker/` is a **standalone Node/Express service**, not part of the
Next.js build — it wraps `whatsapp-web.js` (a headless WhatsApp Web client
via Puppeteer) and exposes two endpoints the Next.js API calls via HTTP:

- `POST /send-broadcast` — rent-reminder messages to tenants with pending
  payment.
- `POST /send-monthly-greeting` — greeting + rent-due message to all active
  tenants.

It listens on **port 4005** by default. `app/api/broadcast/route.ts` and
`app/api/monthly-greeting/route.ts` call it at
`process.env.WHATSAPP_WORKER_URL || "http://localhost:4005"`.

**Run it with `node index.js` from inside `whatsapp-worker/`** — there is no
root-level script or process manager wiring it up to `pnpm dev`; it must be
started separately. See README.md for the day-to-day command.

First run (or after `whatsapp-worker/.wwebjs_auth` is cleared) requires
scanning a QR code printed to the terminal to authenticate the linked WhatsApp
account; after that, the session persists across restarts via `LocalAuth`.
The Chrome executable path is hardcoded in `whatsapp-worker/index.js`
(`CHROME_PATH`) — update it if Chrome for Testing is reinstalled at a new
version path.

If the Next.js app calls `/api/broadcast` or `/api/monthly-greeting` while
this worker isn't running, the fetch to `localhost:4005` fails and the route
returns a `500` — this is expected, not a bug, when the worker is down.

## Testing

Vitest, backend-only by explicit design (`vitest.config.ts`,
`test.include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"]`). No
component/frontend tests exist or should be added — once the backend-only
logic rule holds, components have nothing worth unit testing.

```bash
pnpm test            # run once
pnpm test:watch      # watch mode
pnpm test:coverage    # with coverage (lib/** + app/api/** only)
```

Conventions:
- Test files are co-located next to source (`lib/rent.ts` → `lib/rent.test.ts`).
- `test/mocks/supabase.ts` — chainable/awaitable Supabase query-builder mock.
- `test/fixtures/{tenants,payments,expenses}.ts` — `makeTenant()` etc.
  factories with sane defaults.
- `test/hang-repro/` — narrow escape hatch for regression-testing a
  synchronous infinite-loop bug in `calculateRent` (see below) that can't be
  safely reproduced inline (Vitest's own per-test timeout can't interrupt a
  blocking `while` loop). Runs in an isolated child process via
  `vitest.hang-repro.config.ts` and `test/hang-repro/run-hang-repro.ts`'s
  `runHangRepro()`, which applies a hard OS-level timeout. Don't extend this
  pattern casually — it exists only because this one bug class genuinely
  can't be tested any other way.

`pnpm test` is fully green (no intentionally-failing tests) — a failure
always means a real regression.

### Bugs found and fixed during the test-suite build (`09d5d97`, follow-up fix pass)

The initial backend-test-suite pass found 5 real correctness bugs and
deliberately shipped them as failing characterization tests first (TDD
red/green split), fixing the implementations in a separate follow-up pass.
All 5 are now fixed and their tests pass; documented here since the failure
modes are easy to reintroduce by accident during a future refactor:

1. **`calculateRent` infinite loop** (`lib/rent.ts#calculateRent`) — an
   unparseable `base_rent_as_of` or malformed `targetMonth` produced an
   Invalid Date; every loop comparison against it was `false`, so the
   month-walking `while` loop never terminated. Fixed by checking
   `Number.isNaN(referenceDate.getTime()) || Number.isNaN(targetDate.getTime())`
   right after both dates are constructed and falling back to the
   unmodified base rent instead of entering the loop.
2. **`getRentMonth`/`getPaymentMonth` garbage output** (`lib/rent.ts`) — a
   hyphen-less input (e.g. `""`, `"2026"`) slipped past the malformed-input
   guard (`month` destructured to `undefined`, and `Number.isNaN(undefined)`
   is `false` since it isn't literally `NaN`) and produced `"NaN-NaN"`
   instead of passing through unchanged like every other malformed input.
   Fixed by requiring `parts.length === 2` (from `.split("-")`) before
   attempting the numeric guard at all.
3. **`isActiveTenant` case-sensitivity** (`lib/tenant.ts`) — only an exact
   allowlist (`"true"`, `"TRUE"`, `"yes"`, `"YES"`, `"y"`, `"1"`) counted as
   active, a leftover from when `active` was free text in Google Sheets.
   Initially fixed by case-insensitive matching, but then the legacy
   string/number handling was removed entirely — `active` is a plain
   `boolean` in `types/tenant.ts` and `getActiveTenants` reads
   `tenant.active` directly, no coercion helper at all. This app targets the
   current Supabase schema only; it doesn't need to keep handling a data
   shape (free-text `active`) that no longer exists in the DB.
4. **`lastPaymentDate` staleness**
   (`app/api/tenant-payments/[id]/route.ts#calculateSummary`) — grouped all
   "paid" entries ahead of all "late" entries (`[...paidPayments,
   ...latePayments]`) before picking the first one, so it could report a
   stale date when the truly most recent payment was late. Fixed by
   filtering the already newest-first-sorted `payments` array directly
   (`payments.filter(p => p.status === "paid" || p.status === "late")`)
   instead of concatenating two separately-filtered arrays, which preserves
   the caller's sort order.
5. **`mark-paid` missing validation** (`app/api/mark-paid/route.ts`) — had
   no input validation and no try/catch (every sibling route has both), and
   trusted a client-computed `paid_on` instead of stamping it server-side.
   Fixed: the route now 400s when `tenant_id` or `month` is missing, wraps
   the body in try/catch (malformed JSON → controlled `500`), and falls back
   to `lib/date.ts#currentDate()` when the client omits `paid_on`.

## Package manager

**pnpm is authoritative.** `pnpm-lock.yaml` is current; the `package-lock.json`
at the repo root is a vestigial leftover from the original `create-next-app`
scaffold and hasn't moved — ignore it, don't update it, use `pnpm` for all
installs.
