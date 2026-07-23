# Ideas / Whimsy List

Not a real backlog — a place to dump things that came up while working on
something else, so they don't get lost or derail the task at hand. Check
things off if/when they happen. No pressure, no order.

## Dashboards & data

- [ ] Real charts for expense trends (month-over-month, category over time).
      `app/globals.css` already has `--color-chart-1` … `--color-chart-6`
      seeded from the `dataviz` skill's validated palette — read that skill
      before building anything, it has the form/color/interaction rules.
- [ ] Rent collection trend over time (on-time % by month, across all tenants).
- [ ] A real "Accounts" section — net worth / balances snapshot.
- [ ] CSV export for payment history and expense entries.

## Delight / show-off

- [ ] Celebratory micro-animation when a month's rent is 100% collected
      (confetti, a little bounce on the "Paid" stat tile — something).
- [ ] Bottom-nav badge on the Tenants tab showing pending-rent count.
- [ ] Sound or haptic tick on "Mark as Paid" (mobile only, subtle).
- [ ] Voice input for logging an expense ("₹200 on groceries, cash").

## Accessibility & family-friendliness

- [ ] A "larger text" mode toggle — grandma-specific, beyond the baseline
      sizing already built in.
- [ ] Dark mode. Deliberately skipped this pass (light-only, warm-paper
      palette) — if added, needs its own validated pass, not just an
      automatic invert.
- [ ] PWA / add-to-homescreen so it feels like a native app on people's
      phones (manifest.json, icons, maybe offline shell).

## Structural

- [ ] Build out Accounts / Family / Properties / Documents for real —
      currently just "coming soon" tiles on the Home grid.
- [ ] Search/filter on the tenant and expense lists (not needed yet at
      current data volume, but will be eventually).
- [ ] Offline support / basic caching for spotty connections.
- [ ] Multi-language support if it'd help anyone in the family.

## Code health (full-repo review, 2026-07-23)

Leftovers from a pass across lib/, app/api/, components/, services/, types/,
utils/, and whatsapp-worker/ after the backend + testing + frontend-redesign
phases. Nothing urgent, nothing broken in production — see chat for the full
writeup if any of these need more context before picking one up.

- [ ] Consolidate `PaymentStatus` — declared independently in both
      `types/payment.ts` (unused by anyone) and `lib/payment-status.ts`
      (what every consumer actually imports). `lib/payment-status.ts` should
      import the type from `types/payment.ts` instead of redeclaring it.
- [ ] `services/paymentHistory.ts` predates the Tailwind/testing refactors
      and never got swept up in either. It redefines `Payment` /
      `PaymentSummary` / `MonthlyPayment` / `PaymentHistoryData` from
      scratch instead of reusing `types/payment.ts` (and its local `Payment`
      shape doesn't actually match what `tenant-payments/[id]/route.ts`
      returns — e.g. `paid_on` is typed as required `string`, but the API
      can and does return `null`). Its `getCurrentMonthStatus()` method also
      calls `/api/tenant-payments/[id]/current-month`, a route that doesn't
      exist anywhere in `app/api/` — dead code, no caller.
- [ ] `components/tenants/PaymentHistoryTab.tsx` has its own local
      `formatMonthYear` (locale `en-US`) that duplicates the exported-but-
      never-imported `formatMonthYear` in `utils/date.ts` (locale `en-IN`,
      matching every other date on the site). Delete the unused one or the
      duplicate — right now there are two, disagreeing.
- [ ] `components/tenants/TenantHome.tsx` computes its default "last month"
      via inline `Date` math inside a `useState` initializer. That's the
      "date defaults" category of logic AGENTS.md explicitly says belongs in
      `lib/` — compare `components/expenses/ExpenseHome.tsx`, which does
      this correctly via `lib/date.ts`'s `currentMonth()`.
- [ ] Error handling is inconsistent across `app/api/**`. `mark-paid`,
      `broadcast`, `monthly-greeting`, and `tenant-payments/[id]` wrap their
      handlers in try/catch and return `{ error }` JSON on failure; the
      `dashboard` route and every `expenses` / `expense-items` /
      `expense-categories` route (7 of 10 route files) don't, so an
      unexpected Supabase error there hits Next's default 500 instead of the
      JSON error shape the frontend's toasts expect.
- [ ] `app/api/broadcast/route.ts` and `app/api/monthly-greeting/route.ts`
      both duplicate the same "active tenants with a phone number →
      {id,name,phone,rent}" recipient-list logic — candidate for a shared
      `lib/` helper.
- [ ] `ManageItemsTab.tsx`, `ManageCategoriesTab.tsx`, and
      `ExpenseFormDialog.tsx` each redeclare identical `inputClass` /
      `labelClass` Tailwind strings, and the two Manage*Tab components are
      near-identical list+dialog+confirm-delete CRUD boilerplate — a shared
      `components/ui/` text-field primitive (or a small generic CRUD-list
      pattern) would remove most of the duplication.
- [ ] whatsapp-worker's `/send-broadcast` and `/send-monthly-greeting`
      handlers duplicate validation + connection-check + result-summary
      boilerplate, differing only in the Hindi message template — could
      collapse into one `handleSend(req, res, buildMessage)` helper.
- [ ] Formatting is inconsistent between two "eras" of the codebase: the
      Cosmetic overhaul (`b7fdcb5`) only touched `components/**` and
      `app/**`. Backend-era files it never reached — `lib/rent.ts`,
      `lib/payment-status.ts`, `services/paymentHistory.ts`,
      `app/api/tenant-payments/[id]/route.ts`, `utils/date.ts`,
      `utils/currency.ts` — still carry an older one-argument-per-line style.
      Purely cosmetic (no prettier config exists to enforce either way), but
      worth a pass if those files get touched again.
