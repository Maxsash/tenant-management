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
  WhatsApp rent-reminder broadcasts. `/tenant/insights` is the analytics
  screen — see "Rent insights" below.
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
  security boundary for those two actions is the PIN tier below. The
  "Message on WhatsApp" button beside them is deliberately **not** behind
  this flag: it needs no worker, so it is the one that works in production.
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
  `promptForUnlock` preloads the live session via `GET /api/admin-session`
  while the page becomes usable, then opens the dialog immediately when an
  action needs a higher tier. No action-specific request starts before the
  PIN succeeds. `services/adminSession.ts` keeps that verified level in a
  client-module cache and shares any in-flight status request, so client-side
  navigation does not recheck it; a full reload verifies the HttpOnly cookie
  once. A valid cached session skips the prompt, so several gated buttons and
  pages only prompt once per session, not per click.
  If someone submits a PIN that's valid
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
  hard-`401`s below user-level. `GET /api/rent-analytics` keeps its totals
  open but empties everything that names a tenant (who paid when, tenant
  behaviour, deposits, alerts, upcoming increases) unless at least
  user-level. `dashboard`/`expenses`/`rent-analytics` all include a
  top-level `unlocked: boolean` so the client knows which it got.

  **ADMIN-level** gates (hard `401` via `hasAdminSession(req)` below admin
  tier): `POST`/`PATCH` on `/api/mark-paid`, `PATCH`/`DELETE` on `/api/expenses/[id]`
  (not `POST` — creating an expense stays open to everyone), `POST` on
  `/api/expense-items` and `/api/expense-categories` (not their `GET`s —
  reading the catalog stays open), `PATCH`/`DELETE` on their `/[id]` routes,
  `POST /api/broadcast` / `POST /api/monthly-greeting` (yes, on top of
  the env flag above — closes the "no server check" gap for WhatsApp sends
  too), and `GET /api/whatsapp-links` (its links carry every recipient's
  phone number).

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
                            `/expense` is the default analytics screen;
                            `/expense/log` is the logging screen.
components/tenants/**       Rent/tenant UI (fetch-and-render only).
                            `insights/` holds the rent analytics screen.
components/expenses/**      Expense UI (fetch-and-render only).
                            `entry/` is the logging flow — one sheet that
                            covers a single expense, a whole slip, and a
                            photographed slip (see "Entry sheet" below).
                            `insights/` holds the analytics screen; charts are
                            single-series CSS bars (no chart library), and
                            every derived number arrives from the API already
                            computed — components only pick an index.
components/ui/**            Shared primitives (Button, Card, Dialog, Tabs, …).
                            `sea/` holds the maxsash.com artwork — see "Look
                            and feel" below.
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
  default), `buildPaymentHistory`, `getOnTimeDeadline` (that cutoff as a
  date, for display — a test pins it to agree with `evaluatePaymentStatus`).
- `lib/payments.ts` — `getPaidOnError` (what a payment date may be: a real
  date, any day in the past, at most one day past the server's UTC "today"
  because India's today is often UTC's tomorrow) and `findRentPayment`
  (looks a payment up by tenant and **rent** month).
- `lib/tenant.ts` — `getActiveTenants` (filters to tenants active in a given
  month; wraps the not-exported `isActiveTenant`).
- `lib/rent-ledger.ts` — `buildRentLedger`: one entry per tenant per month
  they owed rent, carrying amount, status and on-time deadline. **The only
  place a tenant and a rent month are put together** — the dashboard, a
  tenant's payment history and the insights screen all read from it, so they
  cannot disagree about who owed what. It decides nothing itself: who owed is
  `getActiveTenants`, how much is `calculateRent`, paid/late/pending is
  `evaluatePaymentStatus`. Also home of `HISTORY_START`.
- `lib/rent-analytics.ts` — everything behind `/tenant/insights`, built on the
  ledger: per-month collection, per-tenant behaviour, deposits, financial
  years, the 12-month projection and the "Needs a look" alerts. See "Rent
  insights" below. `overdueTotals` is also used by `GET /api/dashboard`.
- `lib/numbers.ts` — `round`, `sum`, `median`, and `percentOf`, which never
  rounds to 100 or 0 unless it really is all or nothing.
- `lib/db.ts` — all Supabase reads/writes. Every DB access in the app goes
  through here; nothing outside `lib/db.ts` should call `lib/supabase.ts`
  directly except `lib/db.ts` itself.
- `lib/expenses.ts` — `deriveExpenseFields` (pick/custom/lump-sum expense
  classification logic).
- `lib/expense-summary.ts`, `lib/expense-categories.ts` — expense aggregation
  and category/item grouping helpers.
- `lib/expense-analytics.ts` — everything behind `/expense`:
  `buildExpenseAnalytics` turns the raw rows into month/category/item series
  plus the per-month narrative (deltas, run rate, coverage, price moves,
  recurring gaps). `buildPurchasePatterns` builds the default Need again tab —
  see "Need again: what counts, and how it is grouped" below. Series are built
  across every month that has data and only sliced to the requested window at
  the end, so a delta at the left edge still compares against the real
  previous month. Quantities are only summed when an
  item has been logged in a single unit — see `dominantUnit`. The tuning
  constants for the "usually logged, missing here" check are exported rather
  than inlined, since the heuristic is a judgement call worth seeing.
- `lib/consumption-table.ts` — the month-by-month grid on the Quantities tab.
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
  and components agree on "today." `isValidMonth()` for checking a
  client-supplied `YYYY-MM` before formatting it. `addMonths`/`monthRange`/
  `daysBetween` for timezone-free month and day arithmetic.
- `lib/whatsapp.ts` — everything a rent message is made of: who gets one
  (`getReminderRecipients` = active and pending, `getGreetingRecipients` =
  all active), the Hindi wording (`buildWhatsAppMessage`), and the
  tap-to-send link (`buildWhatsAppLink`). Both ways of sending read from
  here — see "WhatsApp: two ways to send" below — so change the wording here
  and nowhere else.
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
  `validateEntryLines`, and the date handling (`withLineDate`,
  `groupLinesByDate`, `entryLinesDateRange`). Amounts and quantities are held
  as **strings**, since they bind straight to text inputs and a half-typed
  "1." is a legitimate state a number would round away under the user's
  fingers.
- `lib/expense-items.ts` — `rankItemsByUsage`/`suggestItems`: recency-weighted
  purchase counts, so the item picker opens on what the household actually
  buys instead of an empty search box. Only rows linked by `item_id` count.
- `lib/slip-prompt.ts`, `lib/slip-matching.ts`, `lib/slip-image.ts`,
  `lib/slip-reader/` — the slip camera flow; see "Reading handwritten slips"
  below.

### Recording when rent was paid

"Mark as Paid" on the dashboard opens `components/tenants/PaidDateDialog.tsx`
rather than saving at once. It asks for the date the rent was actually paid,
defaulting to today, because marking often happens days after the money
arrived, and `paid_on` is what decides on time vs late. Paid cards carry
"Change date", which opens the same dialog to correct a recorded date. The
dialog shows the month's on-time deadline (`on_time_by` on
`/api/dashboard`) so back-dating is an informed choice.

Server side, `POST /api/mark-paid` takes an optional `paid_on` (omitted means
today) and `PATCH /api/mark-paid` changes the date on an existing payment,
both keyed by tenant and **rent** month and both checked through
`lib/payments.ts#getPaidOnError`. A payment row with no `paid_on` reads as
pending, so `POST` fills that row in instead of refusing or duplicating it.
There is deliberately no way to delete a payment from the app yet.

### Domain concepts worth knowing before touching rent/payment code

- **Rent month vs payment month**: rent for month `M` is due (paid) in month
  `M+1`. `payments.month` in the DB stores the **payment month**, not the
  rent month. `getRentMonth(paymentMonth)` and `getPaymentMonth(rentMonth)`
  in `lib/rent.ts` are the only converters — don't reimplement this
  conversion inline.
- **Payment status** is always evaluated through
  `lib/payment-status.ts#evaluatePaymentStatus` — don't reimplement
  paid/late/pending logic elsewhere.
- **`HISTORY_START = "2023-12"`** (`lib/rent-ledger.ts`, formerly
  `GLOBAL_CUTOFF` in the tenant-payments route) — the earliest rent month the
  app reports on, regardless of how far back `tenant_since` goes (predates
  reliable data).
- **A `vacated_on` on the 1st still owes that month's rent** —
  `getActiveTenants` counts a tenant through the month of `vacated_on`. Two
  older rows (T06, T07) were entered as the 1st and so show one extra month
  unpaid; month-end dates don't have the problem.
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

- `EntrySheet.tsx` — the facts that hold for the whole trip sit in a header
  bar, set once. Lines stack under them, with the running total and Save
  pinned in the footer. A single expense is a basket of one, and editing an
  existing expense is the same sheet with one line, so there is one layout to
  learn rather than two. The date is the exception, see below.
- `ItemPickerPanel.tsx` — slides **over** the sheet rather than sitting inside
  it, which is what stops picking an item from scrolling the amount away. It
  opens on the household's most-bought items (`lib/expense-items.ts`) instead
  of an empty search box, and always offers "log this anyway" so it cannot
  dead-end someone whose word is not in the catalogue.
- `EntryLineRow.tsx` — one line fits on a phone without scrolling: what it was
  on top, then quantity, unit and amount side by side. Choosing an item moves
  the caret straight to the amount, so pick-then-price is one motion. Note
  that `autoFocus` cannot do this — the row already exists by then — hence the
  ref-and-effect. Every row carries its own date as a small `DateChip` under
  the fields.
- `DateChip.tsx` — a date that reads as a label and opens the phone's own
  picker: a real `<input type="date">` sits invisibly over it.
- `SlipPhotos.tsx` — the tray photos wait in before they are read, and the
  full-screen viewer for checking a read against the paper.

**Dates in the sheet.** While every line shares a day, the header date edits
all of them. Once lines span several days the header only shows the range,
lines group under a heading per day (in the order the page first reaches that
day), and tapping a heading moves that day's lines while a line's own date
moves just that line. The row date used to appear only once a basket *already*
spanned several days. That left no way to type a running page in by hand, or
to split a scan that had put the whole page on one day, so the household
ended up saving slips one day at a time.

Two entry points into scanning, because the app is opened from a home-screen
icon and a slip photo is the usual way expenses arrive: a camera button beside
the `+` on the dashboard, and `/expense/log?scan=1`, which opens the sheet leading
with the camera so that URL can be saved as its own icon. A file picker cannot
be opened without a real tap, so neither can skip the one deliberate press —
that is a browser rule, not a missing feature.

Two traps worth knowing before editing `EntrySheet`:

- **The reset effect must not depend on `items` or `categories`.** Those
  arrive from a fetch that lands *after* the sheet opens, and a new array
  identity would re-run the reset and wipe whatever had just been typed or
  scanned. The catalogue is read through `itemsRef` for that reason.
- **A read replaces the basket, it does not append to it** — mixing a
  half-typed line into a freshly read slip makes its totals check lie. The
  sheet confirms first when there is anything to lose, including corrections
  to an earlier read that is being redone with another photo added.
- **Taking a photo does not start a read.** Photos wait in the tray until
  "Read" is pressed, because a page is often written on both sides. The tray
  knows whether the lines on screen came from exactly the photos in it
  (`readPhotoKey`), which is what brings the Read button back when one is
  added or removed.

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
  does run out, and **the list is ordered by what answers, not by what is
  newest.** On 16 September 2026 the newest, `gemini-3.8-flash`, took 100 and
  149 seconds just to return `503 UNAVAILABLE`. With it first, every scan
  outlived the phone's patience and showed Safari's "Load failed". So the
  models are raced by `lib/slip-reader/race.ts#staggeredRace`: each gets a
  head start (`GEMINI_TIMING.staggerMs`), then the next starts alongside it
  and the first answer wins. A busy or rate-limited failure starts the next at
  once. Anything else fails immediately, since a bad key would fail the same
  way on every model. The whole read has a hard deadline
  (`GEMINI_TIMING.deadlineMs`) that keeps it well under a minute. A healthy
  read took ~10 s for a 7-line page and 29–34 s for 25 lines over two photos,
  so a very long slip can run into the deadline; the message then says to read
  it a page at a time. Re-measure (see `test/manual/`) before reordering.
- `lib/slip-reader/anthropic.ts` — `claude-opus-5` via `ANTHROPIC_API_KEY`.
  Reads this handwriting better and does not train on inputs, but bills per
  call; **a Claude Pro subscription does not include API credits**, which is
  why it is not the default. Preferred automatically if a key ever appears.
- `lib/slip-reader/schema.ts` — the answer shape both providers return, and
  the request they share (`buildSlipUserPrompt`, which names the photo
  count), so switching provider changes only transport. The
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

A misread date is a valid date, so it is caught by position instead:
`findSuspectDates` flags a line whose date is in the future, goes backwards,
or leaps further forward than `DATE_TUNING.maxForwardJumpDays` from the line
above. The classic case is 1.9.26 read month-first as 9 January, sitting
between two September lines. Only the line where the date *changes* is
flagged ("date-check"); the fix is one tap on that day's heading, which moves
the whole run and clears the flag.

**Several photos are one slip, read in one request.** A page written on both
sides is the everyday case, and the lines at the top of the back usually
carry the date written on the front. Read separately, those lines would fall
back to today. So `/api/slip-scan` takes up to `MAX_SLIP_PHOTOS` repeated
`image` fields in order, the reader sends every image with a request that
says how many there are, and the prompt tells the model to carry a date
across photos, report an overlapping line once, and not double a total
carried forward. Verified against a synthetic two-sided page straddling a
month end: back-of-page lines landed on the front's last date, and the
combined total matched.

The catalogue is rendered as `- Name | unit`, not `- Name (unit)`. That is
also from a real slip: with parentheses the model copied the unit into the
item name and answered "Paav (packet)", matching nothing and starting a
duplicate beside the real "Paav".

`MATCH_TUNING`, `DATE_TUNING` and the unit alias table are exported rather
than inlined, on the same principle as the analytics constants — they are judgement calls about
handwriting, not facts.

### Phone-first, and what that forces

The app is used mostly from an iPhone, added to the home screen so it runs as
a standalone PWA. These things in this flow exist only because of that:

- `lib/slip-image.ts` downscales and re-encodes every photo to JPEG **on the
  device** before upload. iPhones shoot HEIC, Safari's file input has not been
  consistent across iOS versions about converting it, and a full-resolution
  photo is far past the upload ceiling anyway. A slip reads fine from a 2000px
  long edge. If the browser cannot decode the file, the original is sent and
  the server decides — never drop a photo silently on the device. Each photo
  is squeezed through `ENCODE_STEPS` until it fits `PHOTO_BYTE_BUDGET`, so a
  full set of `MAX_SLIP_PHOTOS` travels in one upload under `MAX_UPLOAD_BYTES`
  — which is itself under Vercel's 4.5 MB request limit, refused before the
  route runs. A test pins that arithmetic.
- The file input carries **no `capture` attribute**, on purpose. With it, iOS
  jumps straight to the camera; without it, iOS offers Photo Library / Take
  Photo / Choose File, and slips are as often photographed earlier and logged
  later. It does carry `multiple`, so both sides can be picked from the
  library at once; the camera takes one at a time, hence "Other side" in the
  tray.
- A fetch that never gets an answer surfaces in Safari as a bare "Load
  failed". `services/slips.ts` rewords it, and a host-level `413`/`504` that
  arrives without the route's JSON, into something the person can act on.
- Amount and quantity inputs are `type="text"` with `inputMode="decimal"`,
  not `type="number"` — it brings up the numeric keypad without the spinner
  and scroll-to-change behaviour that makes a number field hazardous on a
  touchscreen.

## Need again: what counts, and how it is grouped

The default expense tab answers three household questions, in this order:
what to buy soon, which regular payments are coming up, and how long things
last. `lib/expense-analytics.ts#buildPurchasePatterns` returns all three
already arranged (`HouseholdNeeds`); the components only render.

**What counts is decided by the data, not by a repeat alone.** An earlier
version showed any item bought twice, sorted most-overdue first and capped at
twelve, so "Photocopy" (twice in a fortnight) led the screen while the LPG
cylinder, merely due in nine days, fell off the end. Now:

- **Stock** is anything ever logged with a quantity or a unit — a cylinder is
  a unitless `1`, fuel often has its unit with the litres blank. Stock is what
  "lasts".
- **A payment** is never measured and repeats no faster than
  `REGULAR_PAYMENT_MIN_DAYS`: staff, bills, monthly medicines. Monthly ones
  (`MONTHLY_PAYMENT_DAYS`) are due on the same date next month, because
  salaries follow the calendar; stock keeps counting days, because a cylinder
  runs out when it is used up.
- **Neither** — an unmeasured thing repeating fast, like a massage every other
  day or a takeaway — is left out. So is everything in `OCCASION_CATEGORIES`
  (Eating Out, Gifts & Social, Religious, Other), where a repeat is
  coincidence. Those names match the category catalogue; renaming one of those
  categories means updating the constant.

**Grouped by category, because a category is roughly a shop** and groceries
are bought in trips: twenty items on one slip share a date, so the useful
answer is the next trip's list, not twenty countdowns.

- `shopping` — stock due now or soon, one card per category with a rough cost
  (the items' median spend added up), costliest trip first. "Soon" is the last
  `RHYTHM_SOON_FRACTION` of a cycle: two days' notice for vegetables, nine for
  a cylinder that has to be booked.
- `paymentRounds` — payments grouped by due date, so the 1st reads as one sum.
- `lasting` — every stock item by category in the **catalogue's own order**
  (the route reads `expense_categories` for it; losing that read only loses
  the order), regulars first. Bought-once items sit in their category as
  chips rather than a separate "Still learning" list.

**"Lapsed" is not "most due".** Past `RHYTHM_LAPSED_CYCLES` without a purchase
an item reads "not bought for a while": still listed, muted and last, but off
the shopping list and out of the payment total. The most overdue item is
usually the dropped one. Past `RHYTHM_ACTIVE_CYCLES` it disappears.

## Rent insights

`/tenant/insights` uses one filter row (6 months, 1 year, 2 years), a card with
a tappable column per month, and tabs below
(Overview, Month, Tenants, Deposits). `GET /api/rent-analytics?months=`
returns the whole window already derived.

- **Every rupee comes from the ledger.** The payments table holds no amounts
  (`id, tenant_id, month, paid_on`), so collected and expected are
  `calculateRent` over `buildRentLedger` entries. Don't total rent any other
  way.
- **Unpaid splits in two.** `due` is unpaid but still inside its first week;
  `overdue` is past the 7th. A month's on-time rate is null while it is still
  open, since it would only describe the early payers.
- **Money owed counts the whole history, not the window.** A month that fell
  off the left edge is still owed.
- **Current and former tenants are kept apart.** On real data every rupee
  overdue belonged to tenants who had moved out, often settled against a
  deposit or never recorded. One red total would have been misleading, so
  `summary.overdueAmount` is current tenants only; former tenants get
  `formerOwedAmount` and the end of the alert list.
- **Alerts flag change, not habit.** `late_streak` only fires for someone who
  used to pay on time, and "paying later" compares recent payments with the
  ones before them over a fixed 12-month lookback, whatever the window. A
  tenant who has always paid late isn't news every month; their card says so.
  The tuning constants are exported for the same reason as the expense ones.
- **Tapping a month opens the Month tab**, because tapping is asking about
  that month.
- **The chart is a meter** (collected fills a column the height of what was
  due), so `components/ui/MonthColumns.tsx` doesn't fade unfocused months in
  that mode: a faded fill is indistinguishable from the unfilled part.
- **Status marks.** Drawn with `--color-mark-on-time`, `--color-mark-late`
  and `--color-mark-unpaid`, never the text tokens (`--color-warning` is too
  close to danger as a fill). Unpaid is a hollow ring: green and red collapse
  for protanopes and deuteranopes, so shape carries that difference.
- **Financial years** run April to March by rent month.
- **The dashboard shows `overdue_other_months`**: rent current tenants owe from
  any month other than the one on screen, linking to insights. Without it a
  skipped month is invisible unless someone happens to pick it.

## Look and feel

The app wears the look of [maxsash.com](https://www.maxsash.com), the owner's
studio site: sea, sand, ships and maths. Light mode is a sunny harbour, dark
mode the same harbour by moonlight. **The phone's own setting picks the theme**
(`prefers-color-scheme`); there is deliberately no toggle, nothing stored, no
time-of-day logic. Looks only — none of it changes what a screen does.

- **Colours are tokens in `app/globals.css`.** `@theme` holds the light values;
  a `prefers-color-scheme: dark` block in `@layer base` overrides the same
  `--color-*` names, so every `bg-accent`/`text-muted` utility follows the
  theme without a `dark:` class. Add a colour as a token pair (light and dark),
  never as a hex in a component.
- **Text on a filled colour uses its `on-*` token** (`text-on-accent`,
  `text-on-success`, …), not `text-white`: the dark theme's fills are light,
  so their text is dark. Every text/background pair clears 4.5:1 in both
  themes; re-measure if you move a value.
- **Rent marks have their own tokens** (`--color-mark-*`), validated as a set
  per theme with the dataviz skill's `validate_palette.js`. Its comments say
  which warnings remain and what covers them.
- **Shadows are tinted through variables** (`--shadow-tint*`). Tailwind inlines
  `--shadow-*` values into the utilities at build time, so a dark override of
  `--shadow-card` itself would never reach the page.
- **`components/ui/sea/`** is the artwork. `art.ts` holds path data lifted
  from maxsash.com: the Maxsash mark (an integral sign rigged as a mast) and
  four wave bands, each repeating every third of its width so a band drawn at
  double width and slid a third along loops without a seam. `WaveBand` draws
  one band at a fixed height per band (`WAVE_HEIGHT`, not scaled with width,
  so a boat placed against it floats at the same line on any screen);
  `SeaScene` is the full harbour; `Mark` is the logo. All decorative,
  `aria-hidden`, and still under reduced motion.
- **Named utilities** in `globals.css`: `.graph-paper` (squared paper behind
  a panel), `.squiggle` (a drawn wave line in the text colour — page titles,
  the active tab), `.porthole` (brass ring around a round badge), `.sea-fill`.
- **Shared pieces:** `PageHeader` (nautical eyebrow, plain title, squiggle —
  keep the title plain, it is what people read), `ProgressBar` (every
  horizontal bar; don't hand-roll another), and `Button` variants including
  `warning`.
- **Fonts** match maxsash.com: Fraunces (display, with SOFT turned up for a
  rounder serif), Inter (body), JetBrains Mono (eyebrows and small labels).
- **Icons and share cards** (`app/_metadata/`) render outside the page, so
  they use fixed light-theme hexes (`BADGE_COLORS`) rather than tokens. The
  badge is a single SVG because the OG renderer does not clip a positioned
  child to a rounded parent. `app/favicon.ico` was rendered from `app/icon.svg`.

## WhatsApp: two ways to send

Rent reminders and monthly greetings can go out two ways. They share
recipients and wording (`lib/whatsapp.ts`):

- **Bulk, from the laptop** — "Send Monthly Greeting" / "Send Reminders" on
  the tenant dashboard call `/api/broadcast` and `/api/monthly-greeting`,
  which hand whatsapp-worker the finished text for each tenant. One click
  sends to everyone, but only while the worker is running locally, so these
  buttons are hidden unless `NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS` is set.
- **Tap-to-send, from the phone** — "Message on WhatsApp" opens
  `components/tenants/WhatsAppSendSheet.tsx`, which lists
  `GET /api/whatsapp-links?month=&kind=reminder|greeting`: one prefilled
  `wa.me` link per tenant. Tapping one opens WhatsApp with the message typed;
  the admin presses send. No worker, no automation, works from production.
  The links are plain `<a>` elements rendered *before* the tap on purpose —
  opening WhatsApp from code after an `await` counts as a popup and iOS
  blocks it. Tenants with no usable phone come back with `link: null` and
  are shown, not dropped.

Messages sent by tap go from whichever WhatsApp account is on the phone that
taps, not the account linked to the worker.

## whatsapp-worker (separate service)

`whatsapp-worker/` is a **standalone Node/Express service**, not part of the
Next.js build — it wraps `whatsapp-web.js` (a headless WhatsApp Web client
via Puppeteer) and exposes two endpoints the Next.js API calls via HTTP:

- `POST /send-broadcast` — rent-reminder messages to tenants with pending
  payment.
- `POST /send-monthly-greeting` — greeting + rent-due message to all active
  tenants.

Both endpoints only **deliver**: each recipient arrives with its `message`
already written by the Next.js route, and the worker rejects a recipient
without one. The worker holds no wording of its own, so edit messages in
`lib/whatsapp.ts`, never in `whatsapp-worker/index.js`.

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
