# Manual tests

Not part of `pnpm test` — `vitest.config.ts` only includes `lib/**` and
`app/api/**`, so nothing here runs in the normal suite. These need a real API
key and real input, and they cost a request when run.

## slip-e2e.test.ts

Runs a real photograph through the real slip reader and prints the draft that
comes back. This is how the flow gets checked against actual handwriting
rather than against a fixture, and it has already earned its keep: it is what
caught the slips being running ledgers covering several days, and the
catalogue's `name (unit)` rendering being copied into item names.

```bash
cp test/manual/slip-e2e.test.ts lib/__e2e.test.ts
GEMINI_API_KEY=... SLIP_PATH=/path/to/slip.jpg npx vitest run lib/__e2e
rm lib/__e2e.test.ts
```

The copy step is because the config's `include` does not reach this directory.
Extract a page from a scanned PDF with:

```bash
pdftoppm -jpeg -r 150 -f 3 -l 3 slips.pdf /tmp/slip
```

Prefer a real slip. Synthetic printed text does not exercise the thing that
actually goes wrong.
