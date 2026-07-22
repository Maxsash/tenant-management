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
