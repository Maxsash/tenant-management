<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo context for coding agents

This is a **private single-family app** ("Shrivastava Hub") — no public users,
no accounts/login system anywhere. The people using it are the repo owner and
a few relatives, including a non-technical grandmother. Keep that in mind
before suggesting real auth, rate-limiting, multi-tenancy, or other
SaaS-shaped concerns — they're usually not warranted here unless explicitly
requested. There *is* one lightweight exception — two shared numeric PINs
(USER and ADMIN) gating sensitive/write actions, enforced server-side — see
"PIN-gated admin actions" below; it's intentionally not a real auth system
(two shared secrets, no accounts, no per-person identity, no
rate-limiting/lockout).

## What this app does

A Next.js App Router app (`/`) that hubs into a few sub-apps via
`components/Hub.tsx`. Only two are actually implemented today:

- **`/tenant`** — rent tracking: tenants, monthly rent calculation (with
  scheduled increases), payment status (paid/late/pending), payment history,
  WhatsApp rent-reminder broadcasts.
- **`/expense`** — household expense tracking: log expenses against a
  catalog of items/categories, monthly summaries with category breakdowns.
  Logging is basket-shaped (one date and payment method, many lines) and a
  slip can be photographed and read in rather than typed — see "Logging
  expenses: the entry sheet" and "Reading handwritten slips" below.

The other Hub tiles (Accounts, Family, Properties, Documents) are placeholders
— no routes exist for them yet. Don't assume they're implemented.

Data used to live in Google Sheets (see `maxsash-tenant-management-*.json`,
a service-account credential file, now vestigial) and was migrated to
**Supabase** (see commit `b649b0b`). The migration-era compatibility shims
(free-text `active` coercion, etc.) have since been removed — see "Bugs
found and fixed during the test-suite build" below for what changed and why.

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

### PIN-gated admin actions (two tiers: USER and ADMIN)

Two independent, unrelated gates exist — don't conflate them:

- **`NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS === "true"`**
  (`lib/config.ts#isAdminActionsEnabled()`) — a client-only env flag, scoped
  **only** to the WhatsApp buttons (Send Monthly Greeting / Send Reminders in
  `components/tenants/Dashboard.tsx`). Purely hides/shows those two buttons;
  not used anywhere else. This is the only remaining "no server-side check,
  UI-visibility-only" gate in the app, and it's intentional — the actual
  security boundary for those two actions is the PIN tier below.
- **`USER_PIN` / `ADMIN_PIN`** (server-only env vars) — two shared numeric
  PINs, enforced **server-side**, gating everything else. **Hierarchical**:
  an admin-level session satisfies anything a user-level session does, plus
  admin-only actions — there's no "USER can't also do X that ADMIN can't"
  scenario, only "does this need at least USER, or at least ADMIN."

  `types/admin.ts` has the shared `AdminLevel = "user" | "admin"` type.
  `lib/admin-auth.ts` has the primitives: `verifyPin(pin): AdminLevel | null`
  (checks ADMIN_PIN before USER_PIN, so a misconfigured overlap still grants
  the higher tier), `createSessionToken(level)` /
  `getSessionLevel(token): AdminLevel | null` (a signed, 30-day HMAC token
  embedding the tier — no new dependency, uses `node:crypto`; always signed
  with `ADMIN_PIN` regardless of which tier's PIN unlocked the session, so
  rotating `ADMIN_PIN` invalidates every outstanding session at once), and
  `hasUserSession(req)` / `hasAdminSession(req)` (parse the raw `Cookie`
  header — deliberately *not* `next/headers`'s `cookies()`, since route
  tests call handlers directly with plain `new Request(...)` outside any
  Next.js request context; `hasUserSession` is true for either tier,
  `hasAdminSession` only for admin — that's where the hierarchy is actually
  expressed). `POST /api/admin-session` verifies a submitted PIN, resolves
  its tier, and sets an `HttpOnly` cookie; `GET /api/admin-session` reports
  `{ level: AdminLevel | null }` for pages with no other data fetch to
  piggyback on (see `ExpenseSettings`). On the client,
  `hooks/useAdminUnlock.ts` + `components/ui/PinPromptDialog.tsx` are the
  reusable prompt-and-unlock flow — one `useAdminUnlock()` instance per
  top-level page, and every call site passes the `AdminLevel` *that specific
  action* needs: `promptForUnlock("user")` or `promptForUnlock("admin")`.
  `promptForUnlock` checks the live session via `GET /api/admin-session`
  first and only opens the dialog if the current session doesn't already
  meet the bar — so a page with several admin-gated buttons only prompts
  once per session, not per click. If someone submits a PIN that's valid
  but the wrong tier for what triggered the prompt (e.g. the family PIN on
  an admin-only action), the dialog stays open with an explicit "needs the
  admin PIN" error rather than silently failing later.

  **USER-level** gates (viewing sensitive info; a stranger without any PIN
  gets a degraded response, not necessarily an error): `POST /api/slip-scan`
  hard-`401`s below user level (it both reads back household spending and
  spends money at the Anthropic API on every call), `GET /api/dashboard`
  omits `phone`/`tenant_since`/`security_deposit`/`bank`/`increase_*` unless
  at least user-level, `GET /api/expenses` returns `expenses: []` (but real
  `total`/`categoryTotals`, aggregated over the full month regardless of
  lock state) unless at least user-level, and `GET /api/tenant-payments/[id]`
  hard-`401`s below user-level. `dashboard`/`expenses` both include a
  top-level `unlocked: boolean` so the client knows which it got.

  **ADMIN-level** gates (hard `401` via `hasAdminSession(req)` below admin
  tier): `POST /api/mark-paid`, `PATCH`/`DELETE` on `/api/expenses/[id]`
  (not `POST` — creating an expense stays open to everyone), `POST` on
  `/api/expense-items` and `/api/expense-categories` (not their `GET`s —
  reading the catalog stays open), `PATCH`/`DELETE` on their `/[id]` routes,
  and `POST /api/broadcast` / `POST /api/monthly-greeting` (yes, on top of
  the env flag above — closes the "no server check" gap for WhatsApp sends
  too).

  **Deliberately open**, alongside `POST /api/expenses`:
  `POST /api/expenses/bulk`. Saving a whole slip is still creating expenses,
  and the family should not need the admin PIN to log the shopping. Note the
  asymmetry this creates with `/api/slip-scan` above: anyone can type a slip
  in, but reading one off a photo needs at least the family PIN.

  Mirror this pattern (pick the right tier, check `hasUserSession` or
  `hasAdminSession` in the route handler, or shape the response like
  `dashboard`/`expenses` do) for new write-capable or sensitive-read
  modules, rather than introducing real auth, unless asked.

## Directory map

```
app/api/**/route.ts        Route handlers — the only place allowed to talk
                            to lib/db.ts / Supabase directly from a request.
app/{tenant,expense}/       Page shells, just render the top-level component.
                            `/expense/insights` is the analytics screen.
components/tenants/**       Rent/tenant UI (fetch-and-render only).
components/expenses/**      Expense UI (fetch-and-render only).
                            `entry/` is the logging flow — one sheet that
                            covers a single expense, a whole slip, and a
                            photographed slip (see "Entry sheet" below).
                            `insights/` holds the analytics screen; charts are
                            single-series CSS bars (no chart library), and
                            every derived number arrives from the API already
                            computed — components only pick an index.
lib/                        All business logic. See below.
utils/                      Presentation-only formatting helpers (currency,
                            date display, `cn` classname merge) — no domain
                            logic, no fetching. Everything else that touches
                            the shape or meaning of data belongs in lib/.
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
- `lib/expense-analytics.ts` — everything behind `/expense/insights`:
  `buildExpenseAnalytics` turns the raw rows into month/category/item series
  plus the per-month narrative (deltas, run rate, coverage, price moves,
  recurring gaps). Series are built across every month that has data and only
  sliced to the requested window at the end, so a delta at the left edge still
  compares against the real previous month. Quantities are only summed when an
  item has been logged in a single unit — see `dominantUnit`. The tuning
  constants for the "usually logged, missing here" check are exported rather
  than inlined, since the heuristic is a judgement call worth seeing.
- `lib/consumption-table.ts` — the month-by-month grid on the consumption tab.
  A table only ever covers ONE unit, because kilos and pieces cannot share a
  column of numbers; anything else in the category is named in a footnote
  rather than dropped. `listMeasurableCategories` picks the default by
  `coherence * itemCount`, so a big mostly-kilos category beats both a
  many-unit one and a tidy two-item one. Blended rates divide
  `ItemSeries.pricedAmounts` by `pricedQuantities`, never the full totals — a
  row with a price but no weight, or a weight but no price, would otherwise
  push the rupees-per-kilo outside the range of the months it averages.
- `lib/config.ts` — `isAdminActionsEnabled()`, scoped only to the WhatsApp
  buttons (see "PIN-gated admin actions" below).
- `lib/admin-auth.ts` — PIN/session primitives for the real server-side
  admin gate (see "PIN-gated admin actions" below).
- `lib/date.ts` — `currentMonth()`/`currentDate()`, single-sourced so routes
  and components agree on "today."
- `lib/ids.ts` — `newId()` for client-side list keys. Guards
  `crypto.randomUUID`, which does not exist outside a secure context: this app
  is opened from phones over the house LAN on plain http, so an unguarded call
  throws on exactly the devices it is built for.
- `lib/units.ts` — `normalizeMeasure`/`unitsAgree`. Folds written units onto
  the four canonical ones (kg, L, pcs, packet) — 500 g becomes 0.5 kg, a dozen
  becomes 12 pcs. Everything entering from a slip goes through here, because
  consumption analytics can only sum a column that shares a unit, and the same
  vegetable having been logged both ways is what forced the rewrite in step 1
  of `scripts/import-slips-2026-07-to-09.sql`.
- `lib/entry-lines.ts` — the editable line behind the entry sheet, and every
  derivation over it: `slipDraftToEntryLines`, `expenseToEntryLine` (mode is
  re-derived, it is not a column), `entryLineToPayload`, `entryLinesTotal`,
  `validateEntryLines`. Amounts and quantities are held as **strings**, since
  they bind straight to text inputs and a half-typed "1." is a legitimate
  state a number would round away under the user's fingers.
- `lib/expense-items.ts` — `rankItemsByUsage`/`suggestItems`: recency-weighted
  purchase counts, so the item picker opens on what the household actually
  buys instead of an empty search box. Only rows linked by `item_id` count.
- `lib/slip-prompt.ts`, `lib/slip-matching.ts`, `lib/slip-vision.ts` — the
  slip camera flow; see "Reading handwritten slips" below.

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
- **`increase_effective_from`** (optional, on `Tenant`) — delays when the
  `increase_month`/`increase_by` schedule first applies. The base
  `increase_month`/`increase_by`/`base_rent_as_of` model assumes the
  increase recurs every single year it's crossed, with no way to skip one
  occurrence (e.g. a lease with a flat first year before increases start).
  When set, `calculateRent` returns flat `base_rent` for any target month
  before it, and uses it (instead of `base_rent_as_of`) as the walk origin
  from that month onward — valid because `base_rent` hasn't changed between
  the two by construction. Omit it and behavior is identical to before this
  field existed; every pre-existing tenant row omits it.

## Logging expenses: the entry sheet

`components/expenses/entry/` replaced the old one-expense-at-a-time
`ExpenseFormDialog` + `ItemPicker` (both deleted). The complaint it was built
to answer was scrolling back and forth for even a simple entry: the old dialog
stacked a mode switcher, an item picker, amount, date, quantity, unit, payment
method and notes down one scrolling column, so choosing an item pushed the
amount off-screen.

The shape now follows the paper. **A slip is one date, one payment method and
many lines**, so:

- `EntrySheet.tsx` — the two facts that hold for the whole trip sit in a
  header bar, set once. Lines stack under them, with the running total and
  Save pinned in the footer. A single expense is a basket of one, and editing
  an existing expense is the same sheet with one line, so there is one layout
  to learn rather than two.
- `ItemPickerPanel.tsx` — slides **over** the sheet rather than sitting inside
  it, which is what stops picking an item from scrolling the amount away. It
  opens on the household's most-bought items (`lib/expense-items.ts`) instead
  of an empty search box, and always offers "log this anyway" so it cannot
  dead-end someone whose word is not in the catalogue.
- `EntryLineRow.tsx` — one line fits on a phone without scrolling: what it was
  on top, then quantity, unit and amount side by side. Choosing an item moves
  the caret straight to the amount, so pick-then-price is one motion. Note
  that `autoFocus` cannot do this — the row already exists by then — hence the
  ref-and-effect. A date field appears on the row only when the basket spans
  several days, where the date is news rather than noise.

Two entry points into scanning, because the app is opened from a home-screen
icon and a slip photo is the usual way expenses arrive: a camera button beside
the `+` on the dashboard, and `/expense?scan=1`, which opens the sheet leading
with the camera so that URL can be saved as its own icon. A file picker cannot
be opened without a real tap, so neither can skip the one deliberate press —
that is a browser rule, not a missing feature.

Two traps worth knowing before editing `EntrySheet`:

- **The reset effect must not depend on `items` or `categories`.** Those
  arrive from a fetch that lands *after* the sheet opens, and a new array
  identity would re-run the reset and wipe whatever had just been typed or
  scanned. The catalogue is read through `itemsRef` for that reason.
- **A scan replaces the basket, it does not append to it** — mixing a
  half-typed line into a freshly read slip makes its totals check lie. The
  sheet confirms first when there is anything to lose.

## Reading handwritten slips

Photograph a slip, get draft rows to correct, save the ones you confirm. The
manual pipeline this replaces is preserved in
`scripts/import-slips-2026-07-to-09.sql` — worth reading before touching any
of this, since it is the ground truth for what these slips actually look like.

**The reader is pluggable, and which one runs is a cost decision.**
`lib/slip-reader/` holds one module per provider behind a common `SlipReader`
interface; `getSlipReader()` picks the first whose key is set, Anthropic
before Gemini. With neither, `/api/slip-scan` returns a `501` naming both
variables and nothing else in the app is affected.

- `lib/slip-reader/gemini.ts` — **the one that actually runs here.**
  `GEMINI_MODELS` via `GEMINI_API_KEY`, because Gemini's free tier is
  indefinite, needs no card, and covers the Flash models. Two consequences to
  keep in view: Flash reads handwritten Devanagari less reliably than a
  frontier model, and **the free tier may train on what it is sent** (the paid
  tier and Vertex do not). Every slip photographed through it is household
  spending handed to Google on those terms. It also decodes HEIC/HEIF, which
  the Anthropic reader does not — hence `imageTypes` being per-provider.
  There is a *list* of models rather than one because the free tier really
  does run out: the newest Flash returns `503 UNAVAILABLE` under load often
  enough to hit on an ordinary evening. A capacity or rate-limit failure moves
  down the list (a different model usually has room when one does not);
  anything else fails immediately, since a bad key would fail the same way on
  every model.
- `lib/slip-reader/anthropic.ts` — `claude-opus-5` via `ANTHROPIC_API_KEY`.
  Reads this handwriting better and does not train on inputs, but bills per
  call; **a Claude Pro subscription does not include API credits**, which is
  why it is not the default. Preferred automatically if a key ever appears.
- `lib/slip-reader/schema.ts` — the answer shape both providers return, and
  the prompt they share, so switching provider changes only transport. The
  model's answer is re-validated with zod even when the provider claims to
  have constrained it — a caller about to write rows should never be handed a
  half-parsed slip.
- `lib/slip-prompt.ts` — the instructions. Two things in it are load-bearing:
  the **day-first date convention** (`3.7.26` is 3 July 2026 — read
  month-first it becomes 7 March and files the whole slip in the wrong month),
  and the **catalogue**, which is what makes the model answer "Aaloo" rather
  than "Potato".
- `lib/slip-matching.ts` — everything that decides what the answer *means*,
  and therefore everything worth unit-testing. Matches names against the
  catalogue through `foldName`, which converges Hinglish spelling drift
  (Aaloo/Aalu/Alu, Pyaaz/Pyaz) before comparing.

Why matching leans on `item_id`: `lib/expense-analytics.ts` keys an item's
history by it and only falls back to the name, so a slip line that lands as
free text starts a second, parallel history for something already tracked.

Why it still flags: only an **exact** folded match is treated as settled.
Anything else comes back `fuzzy`, or `ambiguous` when a second item scored
nearly as well — the common case being a slip that writes the plain word
("Mirch powder") where the catalogue holds two variants of it. Silently
attaching a line to the wrong item is worse than asking, so every uncertain
line reaches the review screen carrying its reason.

The **totals check** is the one that earns its keep: a slip usually writes its
own total, and comparing it against the sum of the lines catches a whole line
having been missed, which no per-line confidence can. It re-runs live as the
person corrects the draft, so fixing a line clears the warning.

**Dates live on the line, not on the slip.** This is the single most important
thing here and it is not obvious from the name "slip": a photographed page is
usually a *running ledger*, a date written once with ditto marks under it, and
it routinely straddles the end of a month. The first real slip tested covered
31 August to 3 September on one page. An earlier design carried one date for
the whole basket, which would have filed that August spending into September
and skewed every month-over-month figure on the insights screen. So:
`SlipLine.line_date`, `SlipDraftLine.expense_date`, `EntryLine.date` and a
per-line `expense_date` on `/api/expenses/bulk` all exist for that reason.
`buildSlipDraft` carries the last seen date down lines the reader left
undated, and the top-level `expense_date` is only the header's opening value —
never the authority. Do not collapse these back into one date.

The catalogue is rendered as `- Name | unit`, not `- Name (unit)`. That is
also from a real slip: with parentheses the model copied the unit into the
item name and answered "Paav (packet)", matching nothing and starting a
duplicate beside the real "Paav".

`MATCH_TUNING` and the unit alias table are exported rather than inlined, on
the same principle as the analytics constants — they are judgement calls about
handwriting, not facts.

### Phone-first, and what that forces

The app is used mostly from an iPhone, added to the home screen so it runs as
a standalone PWA. Three things in this flow exist only because of that:

- `lib/slip-image.ts` downscales and re-encodes every photo to JPEG **on the
  device** before upload. iPhones shoot HEIC, Safari's file input has not been
  consistent across iOS versions about converting it, and a full-resolution
  photo is far past the upload ceiling anyway. A slip reads fine from a 2000px
  long edge. If the browser cannot decode the file, the original is sent and
  the server decides — never drop a photo silently on the device.
- The file input carries **no `capture` attribute**, on purpose. With it, iOS
  jumps straight to the camera; without it, iOS offers Photo Library / Take
  Photo / Choose File, and slips are as often photographed earlier and logged
  later.
- Amount and quantity inputs are `type="text"` with `inputMode="decimal"`,
  not `type="number"` — it brings up the numeric keypad without the spinner
  and scroll-to-change behaviour that makes a number field hazardous on a
  touchscreen.

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

- `test/manual/` — not in the config's `include`, so nothing there runs in the
  normal suite. It holds the end-to-end slip reader check, which needs a real
  API key and a real photograph and costs a request. Worth running against
  actual handwriting after touching the prompt or the matcher: it is what
  caught both the running-ledger dates and the `name (unit)` bug, neither of
  which any fixture would have shown. See `test/manual/README.md`.

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

`@google/genai`, `@anthropic-ai/sdk` and `zod` were added for the slip reader
and are used only under `lib/slip-reader/`. `zod` is there for that one
structured-output schema, not as a general validation library — the rest of
the app validates by hand in route handlers, and there is no plan to change
that.
