"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, ShoppingBasket, X } from "lucide-react";

import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EntryLineRow from "./EntryLineRow";
import ItemPickerPanel from "./ItemPickerPanel";
import { PAYMENT_METHODS } from "@/lib/expense-categories";
import { totalsAgree } from "@/lib/slip-matching";
import { currentDate } from "@/lib/date";
import { newId } from "@/lib/ids";
import {
  applyItemToLine,
  createEntryLine,
  entryLinesTotal,
  entryLineToPayload,
  expenseToEntryLine,
  groupLinesByDate,
  isBlankLine,
  slipDraftToEntryLines,
  spansMultipleDates,
  validateEntryLines,
  type EntryLine,
} from "@/lib/entry-lines";
import { prepareSlipPhoto } from "@/lib/slip-image";
import { scanSlip } from "@/services/slips";
import { formatCurrency } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import { cn } from "@/utils/cn";
import type { Expense, ExpenseCategory, ExpenseItem } from "@/types/expense";
import type { AdminLevel } from "@/types/admin";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: ExpenseItem[];
  categories: ExpenseCategory[];
  suggested: ExpenseItem[];
  /** Opened to photograph a slip, so lead with the camera rather than a row. */
  scanIntent?: boolean;
  editingExpense?: Expense | null;
  promptForUnlock: (level: AdminLevel) => Promise<boolean>;
};

/**
 * Logging what was spent.
 *
 * A slip from the market is one date, one payment method and a dozen lines,
 * so that is the shape of this sheet: the two things that are true of the
 * whole trip are set once at the top, and the lines stack under them. Adding
 * a line opens the picker over the sheet rather than below it, so choosing
 * what you bought never scrolls the amount away — which is what made logging
 * a real slip through the old one-item-at-a-time dialog such a chore.
 *
 * Editing an existing expense is the same sheet with a single line, so there
 * is one layout to learn rather than two.
 */
export default function EntrySheet({
  open,
  onClose,
  onSaved,
  items,
  categories,
  suggested,
  scanIntent,
  editingExpense,
  promptForUnlock,
}: Props) {
  const [expenseDate, setExpenseDate] = useState(currentDate);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [lines, setLines] = useState<EntryLine[]>([]);
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statedTotal, setStatedTotal] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [pendingScan, setPendingScan] = useState<File | null>(null);
  // Kept so the slip stays on screen while its lines are being checked —
  // reviewing a reading against the paper is the whole job, and the photo is
  // already on the device. Revoked whenever it is replaced or the sheet shuts.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(editingExpense);

  // The catalogue arrives from a fetch that lands *after* the sheet opens, so
  // a new `items` array would otherwise re-run the reset effect below and wipe
  // whatever had just been typed or scanned. Read through a ref instead, and
  // reset only when the sheet is actually opened.
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!open) return;

    // Deferred to a microtask so opening the sheet does not set a dozen pieces
    // of state synchronously inside the effect (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      setError(null);
      setProblems({});
      setConfirmingDelete(false);
      setPickerLineId(null);
      setFocusLineId(null);
      setStatedTotal(null);
      setUnreadable(null);
      setPendingScan(null);
      setPhotoOpen(false);
      setPhotoUrl(null);

      if (editingExpense) {
        setExpenseDate(editingExpense.expense_date.slice(0, 10));
        setPaymentMethod(editingExpense.payment_method);
        setLines([expenseToEntryLine(editingExpense, itemsRef.current)]);
      } else {
        const today = currentDate();
        const first = createEntryLine({ id: newId(), date: today });

        setExpenseDate(today);
        setPaymentMethod("Cash");
        setLines([first]);

        // Tapping "+" means "I want to log something", and the next thing is
        // always choosing what. Opening the picker with it spares a tap on an
        // empty row that can only say "Choose item…".
        if (!scanIntent) setPickerLineId(first.id);
      }
    });
  }, [open, editingExpense, scanIntent]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const patchLine = useCallback((id: string, patch: Partial<EntryLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
    setProblems((current) => {
      if (!current[id]) return current;

      const next = { ...current };
      delete next[id];

      return next;
    });
  }, []);

  function addLine(mode: EntryLine["mode"]) {
    const line = createEntryLine({
      id: newId(),
      // A new line joins the day the last one was on, which is right both for
      // a single-day basket and for carrying on down a running page.
      date: lines[lines.length - 1]?.date ?? expenseDate,
      mode,
      category: mode === "lump" ? (categories[0]?.name ?? "") : "",
    });

    setLines((current) => [...current, line]);

    // Adding an item line is always followed by choosing one, so skip the tap.
    if (mode === "lump") setFocusLineId(line.id);
    else setPickerLineId(line.id);
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  /**
   * The header date is the basket's date, so changing it moves every line
   * that was on the old one. Lines a scan put on a different day stay put —
   * otherwise correcting the header would silently flatten a running page
   * back onto one date, which is the bug this whole per-line dance avoids.
   */
  function changeHeaderDate(next: string) {
    const previous = expenseDate;

    setExpenseDate(next);
    setLines((current) =>
      current.map((line) => (line.date === previous ? { ...line, date: next } : line))
    );
  }

  function handlePick(item: ExpenseItem) {
    if (!pickerLineId) return;

    setLines((current) =>
      current.map((line) =>
        line.id === pickerLineId ? applyItemToLine(line, item) : line
      )
    );
    setFocusLineId(pickerLineId);
    setPickerLineId(null);
  }

  function handlePickCustom(name: string, category: string) {
    if (!pickerLineId) return;

    patchLine(pickerLineId, {
      mode: "custom",
      item_id: null,
      item_name: name,
      category,
    });
    setFocusLineId(pickerLineId);
    setPickerLineId(null);
  }

  function requestScan(file: File) {
    // A scan replaces the basket rather than appending to it, because mixing a
    // half-typed line into a freshly read slip makes its totals check lie. So
    // ask before throwing away work.
    if (lines.some((line) => !isBlankLine(line))) {
      setPendingScan(file);
      return;
    }

    handleScan(file);
  }

  async function handleScan(file: File) {
    setPendingScan(null);

    // Reading a slip needs a PIN, so ask up front rather than after the
    // shutter and a failed upload.
    if (!(await promptForUnlock("user"))) return;

    setScanning(true);
    setError(null);

    try {
      // Downscaled and re-encoded on the device first: an iPhone shoots HEIC
      // at a resolution far past the upload ceiling, and a slip reads fine
      // from a fraction of it. See lib/slip-image.ts.
      const photo = await prepareSlipPhoto(file);

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(photo);
      });

      const draft = await scanSlip(photo);
      const scanned = slipDraftToEntryLines(draft);

      if (scanned.length === 0) {
        toast.error("No lines could be read off that photo");
        return;
      }

      setExpenseDate(draft.expense_date);
      setStatedTotal(draft.statedTotal);
      setUnreadable(draft.unreadable);
      setLines(scanned);
      setProblems({});
      toast.success(`Read ${scanned.length} lines — check them before saving`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that slip");
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    setError(null);

    const { lines: filled, problems: found } = validateEntryLines(lines);

    if (filled.length === 0) {
      setError("Nothing to save yet — add a line first.");
      return;
    }

    if (found.length > 0) {
      setProblems(Object.fromEntries(found.map((p) => [p.lineId, p.message])));
      setError(
        found.length === 1
          ? "One line still needs something."
          : `${found.length} lines still need something.`
      );
      return;
    }

    // Correcting an existing expense needs the admin PIN; creating never
    // does. The routes enforce both — this just avoids a doomed round trip.
    if (isEditing && !(await promptForUnlock("admin"))) return;

    setSaving(true);

    try {
      const res = isEditing
        ? await fetch(`/api/expenses/${editingExpense!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...entryLineToPayload(filled[0]),
              expense_date: expenseDate,
              payment_method: paymentMethod,
            }),
          })
        : await fetch("/api/expenses/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expense_date: expenseDate,
              payment_method: paymentMethod,
              lines: filled.map(entryLineToPayload),
            }),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      toast.success(
        isEditing
          ? "Expense updated"
          : filled.length === 1
            ? "Expense added"
            : `${filled.length} expenses added`
      );

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingExpense) return;
    if (!(await promptForUnlock("admin"))) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete expense");

      toast.success("Expense deleted");
      setConfirmingDelete(false);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const basketEmpty = lines.every(isBlankLine);
  const needsCheck = lines.filter((line) => line.reviewReasons.length > 0).length;
  const showCameraCard = Boolean(scanIntent) && !scanning && basketEmpty;
  const dateGroups = groupLinesByDate(lines);
  const multiDay = spansMultipleDates(lines);
  const total = entryLinesTotal(lines);
  const agreement = totalsAgree(statedTotal, total);
  const savableCount = lines.filter((line) => line.amount.trim()).length;

  return (
    <>
      <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <AnimatePresence>
          {open && (
            <RadixDialog.Portal forceMount>
              <RadixDialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 28 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:bg-black/40 md:p-6"
                >
                  <RadixDialog.Content asChild forceMount>
                    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface md:h-[88vh] md:max-w-2xl md:rounded-2xl md:border md:border-border md:shadow-float">
                      <header
                        className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"
                        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
                      >
                        <RadixDialog.Title className="font-display text-xl font-semibold text-foreground">
                          {isEditing ? "Edit Expense" : "Add Expenses"}
                        </RadixDialog.Title>

                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={scanning}
                              aria-label="Read a slip from a photo"
                              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
                            >
                              {scanning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Camera className="h-4 w-4" />
                              )}
                              <span className="hidden sm:inline">Scan slip</span>
                            </button>
                          )}

                          <RadixDialog.Close
                            aria-label="Close"
                            className="rounded-full p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                          >
                            <X className="h-5 w-5" />
                          </RadixDialog.Close>
                        </div>
                      </header>

                      {/* The two facts that hold for the whole trip, set once.
                          Dropped entirely while the camera card is up, where
                          there is nothing yet to date and the scan sets it
                          anyway. Rendered conditionally rather than with the
                          `hidden` attribute, which Tailwind's `flex` would
                          override. */}
                      {!showCameraCard && (
                      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:px-6">
                        <label className="flex items-center gap-2">
                          <span className="sr-only">Date</span>
                          <input
                            type="date"
                            value={expenseDate}
                            onChange={(e) => changeHeaderDate(e.target.value)}
                            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground outline-none [color-scheme:light] focus:border-accent sm:w-44"
                          />
                        </label>

                        <SegmentedControl
                          ariaLabel="Paid via"
                          className="flex-1"
                          value={paymentMethod}
                          onChange={setPaymentMethod}
                          options={PAYMENT_METHODS.map((m) => ({
                            value: m,
                            label: m === "Bank Transfer" ? "Bank" : m,
                          }))}
                        />
                      </div>
                      )}

                      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                        <div className="mx-auto flex max-w-xl flex-col gap-3">
                          {scanning && (
                            <div className="flex flex-col items-center gap-3 rounded-2xl bg-accent-soft px-4 py-8 text-center">
                              {photoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={photoUrl}
                                  alt=""
                                  className="h-32 w-auto rounded-lg border border-border object-cover opacity-70"
                                />
                              )}
                              <p className="flex items-center gap-2 text-sm font-medium text-accent">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Reading the slip…
                              </p>
                              {/* Honest about the wait: the read takes tens of
                                  seconds, and an unexplained spinner that long
                                  reads as broken on a phone. */}
                              <p className="text-xs text-muted">
                                This takes up to half a minute. Keep the app open.
                              </p>
                            </div>
                          )}

                          {/* Opened from the camera button, with nothing typed
                              yet: the photo is the whole point, so it gets a
                              target you cannot miss. A file picker needs a real
                              tap to open, so this cannot be skipped for them. */}
                          {showCameraCard && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft px-5 py-10 text-center transition-colors hover:bg-accent-soft/70"
                            >
                              <Camera className="h-8 w-8 text-accent" aria-hidden="true" />
                              <span className="font-display text-lg font-semibold text-foreground">
                                Take a photo of the slip
                              </span>
                              <span className="max-w-xs text-sm text-muted">
                                Or pick one you already took. You will get a chance to
                                check every line before it saves.
                              </span>
                            </button>
                          )}

                          {photoUrl && !scanning && (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
                              <button
                                type="button"
                                onClick={() => setPhotoOpen(true)}
                                className="shrink-0"
                                aria-label="View the slip photo"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photoUrl}
                                  alt="The slip being checked"
                                  className="h-14 w-14 rounded-lg border border-border object-cover"
                                />
                              </button>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {needsCheck > 0
                                    ? `${needsCheck} of ${lines.length} lines need a look`
                                    : `${lines.length} lines read, none flagged`}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setPhotoOpen(true)}
                                  className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                                >
                                  Tap the photo to check against the slip
                                </button>
                              </div>
                            </div>
                          )}

                          {unreadable && (
                            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                              Couldn’t read part of it: {unreadable}
                            </p>
                          )}

                          {multiDay && (
                            <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
                              This page covers {dateGroups.length} days. Each line keeps
                              its own date.
                            </p>
                          )}

                          {!showCameraCard &&
                            dateGroups.map((group) => (
                            <section key={group.date} className="flex flex-col gap-2.5">
                              {multiDay && (
                                <div className="flex items-center gap-2 pt-1">
                                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                                    {formatShortDate(group.date)}
                                  </h3>
                                  <span className="h-px flex-1 bg-border" />
                                  <span className="text-xs font-medium text-muted">
                                    {formatCurrency(entryLinesTotal(group.lines))}
                                  </span>
                                </div>
                              )}

                              <ul className="flex flex-col gap-2.5">
                                {group.lines.map((line) => (
                                  <EntryLineRow
                                    key={line.id}
                                    line={line}
                                    categories={categories}
                                    problem={problems[line.id]}
                                    autoFocusAmount={focusLineId === line.id}
                                    showDate={multiDay}
                                    onChange={(patch) => patchLine(line.id, patch)}
                                    onChooseItem={() => setPickerLineId(line.id)}
                                    onRemove={
                                      isEditing || lines.length === 1
                                        ? undefined
                                        : () => removeLine(line.id)
                                    }
                                  />
                                ))}
                              </ul>
                            </section>
                            ))}

                          {!isEditing && (
                            <div className="flex gap-2.5">
                              <Button
                                variant="outline"
                                onClick={() => addLine("pick")}
                                className="flex-1"
                              >
                                <Plus className="h-4 w-4" />
                                Add item
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => addLine("lump")}
                                className="shrink-0"
                              >
                                <ShoppingBasket className="h-4 w-4" />
                                Lump sum
                              </Button>
                            </div>
                          )}

                          {agreement === false && (
                            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                              The slip says {formatCurrency(statedTotal ?? 0)}, these lines
                              come to {formatCurrency(total)}. A line may be missing or
                              misread.
                            </p>
                          )}

                          {agreement === true && (
                            <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
                              Matches the slip’s own total of{" "}
                              {formatCurrency(statedTotal ?? 0)}.
                            </p>
                          )}

                          {error && (
                            <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
                              {error}
                            </p>
                          )}
                        </div>
                      </div>

                      <footer
                        className="shrink-0 border-t border-border px-5 py-4 sm:px-6"
                        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                      >
                        <div className="mx-auto flex max-w-xl items-center gap-3">
                          {isEditing ? (
                            <Button
                              variant="danger"
                              onClick={() => setConfirmingDelete(true)}
                              disabled={saving}
                            >
                              Delete
                            </Button>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted">Total</p>
                              <p className="font-display text-xl font-semibold text-foreground">
                                {formatCurrency(total)}
                              </p>
                            </div>
                          )}

                          <Button
                            onClick={handleSave}
                            loading={saving}
                            disabled={scanning}
                            className={cn(isEditing && "ml-auto")}
                          >
                            {isEditing
                              ? "Save"
                              : savableCount > 1
                                ? `Save ${savableCount} entries`
                                : "Save"}
                          </Button>
                        </div>
                      </footer>

                      <AnimatePresence>
                        {photoOpen && photoUrl && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPhotoOpen(false)}
                            aria-label="Close the photo"
                            className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt="The slip being checked"
                              className="max-h-full max-w-full object-contain"
                            />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {pickerLineId && (
                          <ItemPickerPanel
                            categories={categories}
                            items={items}
                            suggested={suggested}
                            onPick={handlePick}
                            onPickCustom={handlePickCustom}
                            onClose={() => setPickerLineId(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </RadixDialog.Content>
                </motion.div>
              </RadixDialog.Overlay>
            </RadixDialog.Portal>
          )}
        </AnimatePresence>
      </RadixDialog.Root>

      {/* No `capture` attribute on purpose: with it, iOS jumps straight to the
          camera, and slips are as often photographed earlier and logged later.
          Without it iOS offers Photo Library / Take Photo / Choose File, and a
          laptop still shows its ordinary file chooser. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) requestScan(file);
        }}
      />

      <ConfirmDialog
        open={pendingScan !== null}
        onOpenChange={(next) => !next && setPendingScan(null)}
        title="Replace what you've added?"
        description="Reading a slip starts the list over, so the lines already here would be lost."
        confirmLabel="Read the slip"
        onConfirm={() => pendingScan && handleScan(pendingScan)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this expense?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
