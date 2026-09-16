"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CalendarRange, Camera, Loader2, Plus, ShoppingBasket, X } from "lucide-react";

import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import DateChip from "./DateChip";
import EntryLineRow from "./EntryLineRow";
import ItemPickerPanel from "./ItemPickerPanel";
import { SlipPhotoTray, SlipPhotoViewer, type SlipPhotoTrayState } from "./SlipPhotos";
import { PAYMENT_METHODS } from "@/lib/expense-categories";
import { totalsAgree } from "@/lib/slip-matching";
import { currentDate } from "@/lib/date";
import { newId } from "@/lib/ids";
import {
  applyItemToLine,
  createEntryLine,
  entryLinesDateRange,
  entryLinesTotal,
  entryLineToPayload,
  expenseToEntryLine,
  groupLinesByDate,
  isBlankLine,
  slipDraftToEntryLines,
  spansMultipleDates,
  validateEntryLines,
  withLineDate,
  type EntryLine,
} from "@/lib/entry-lines";
import {
  MAX_SLIP_PHOTOS,
  prepareSlipPhoto,
  type SlipPhoto,
} from "@/lib/slip-image";
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
 *
 * Dates are the exception to "set once": a slip is often a running page
 * covering several days, so every line carries its own. While the lines share
 * a day the header edits it for all of them; once they span several, the
 * header only summarises, and each day's heading moves its lines.
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
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  // Kept so the slip stays on screen while its lines are being checked —
  // reviewing a reading against the paper is the whole job, and the photos
  // are already on the device. Each preview URL is revoked when its photo is
  // removed or the sheet resets.
  const [photos, setPhotos] = useState<SlipPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  // Which photos the lines on screen were read from, so adding or removing
  // one shows that a fresh read is due.
  const [readPhotoKey, setReadPhotoKey] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Revokes whatever previews are still live when the sheet goes away.
  useEffect(() => () => releasePhotos(photosRef.current), []);
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
      setConfirmingReplace(false);
      setViewerIndex(null);
      releasePhotos(photosRef.current);
      setPhotos([]);
      setReadPhotoKey(null);

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
   * Moves some lines to another day. Used by a single line's date, by a day's
   * heading (every line under it), and by the header while all lines share a
   * day. The header is never offered once lines span several days — changing
   * it then would either flatten a running page back onto one date, the bug
   * this whole per-line design exists to avoid, or quietly move only some.
   */
  function moveLinesToDate(ids: string[], next: string) {
    const moving = new Set(ids);

    setLines((current) =>
      current.map((line) => (moving.has(line.id) ? withLineDate(line, next) : line))
    );
  }

  function changeBasketDate(next: string) {
    setExpenseDate(next);
    moveLinesToDate(
      lines.map((line) => line.id),
      next
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

  async function addPhotos(files: File[]) {
    const room = MAX_SLIP_PHOTOS - photos.length;

    if (room <= 0) {
      toast.error(`One slip can have up to ${MAX_SLIP_PHOTOS} photos`);
      return;
    }

    if (files.length > room) {
      toast.error(`Only the first ${room} added — one slip can have up to ${MAX_SLIP_PHOTOS} photos`);
    }

    setPreparingPhotos(true);
    setError(null);

    try {
      // Downscaled and re-encoded on the device first: an iPhone shoots HEIC
      // at a resolution far past the upload ceiling, and a slip reads fine
      // from a fraction of it. See lib/slip-image.ts.
      const prepared = await Promise.all(files.slice(0, room).map(prepareSlipPhoto));

      setPhotos((current) => [
        ...current,
        ...prepared.map((file) => ({ id: newId(), file, url: URL.createObjectURL(file) })),
      ]);
    } finally {
      setPreparingPhotos(false);
    }
  }

  function removePhoto(id: string) {
    const photo = photos.find((p) => p.id === id);

    if (photo) releasePhotos([photo]);
    setPhotos((current) => current.filter((p) => p.id !== id));
  }

  function requestRead() {
    // A read replaces the basket rather than appending to it, because mixing
    // a half-typed line into a freshly read slip makes its totals check lie.
    // So ask before throwing away work — including corrections to an earlier
    // read, which is what re-reading with the back of the page added costs.
    if (lines.some((line) => !isBlankLine(line))) {
      setConfirmingReplace(true);
      return;
    }

    readPhotos();
  }

  async function readPhotos() {
    setConfirmingReplace(false);

    if (photos.length === 0) return;

    // Reading a slip needs a PIN, so ask before the upload rather than after
    // a failed one.
    if (!(await promptForUnlock("user"))) return;

    const reading = photos;

    setScanning(true);
    setError(null);

    try {
      const draft = await scanSlip(reading.map((photo) => photo.file));
      const scanned = slipDraftToEntryLines(draft);

      if (scanned.length === 0) {
        toast.error(
          reading.length > 1
            ? "No lines could be read off those photos"
            : "No lines could be read off that photo"
        );
        return;
      }

      setExpenseDate(draft.expense_date);
      setStatedTotal(draft.statedTotal);
      setUnreadable(draft.unreadable);
      setLines(scanned);
      setProblems({});
      setReadPhotoKey(photoKey(reading));
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
            // The line's own date, which the header and the line's date
            // label both edit.
            body: JSON.stringify({
              ...entryLineToPayload(filled[0]),
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
  const trayState: SlipPhotoTrayState = scanning
    ? "reading"
    : readPhotoKey !== null && readPhotoKey === photoKey(photos)
      ? "read"
      : "staged";
  const showCameraCard =
    Boolean(scanIntent) && basketEmpty && photos.length === 0 && !preparingPhotos;
  // With photos waiting and nothing typed, the photos are the whole screen:
  // there is no date or payment to set yet, and a lone empty line under them
  // would only invite typing what is about to be read.
  const hideBasket =
    basketEmpty && (showCameraCard || (photos.length > 0 && trayState !== "read"));
  const dateGroups = groupLinesByDate(lines);
  const multiDay = spansMultipleDates(lines);
  const dateRange = entryLinesDateRange(lines);
  const basketDate = lines[0]?.date ?? expenseDate;
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
                  className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:bg-sea-abyss/45 md:p-6 md:backdrop-blur-[2px]"
                >
                  <RadixDialog.Content asChild forceMount>
                    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface md:h-[88vh] md:max-w-2xl md:rounded-2xl md:border md:border-border md:shadow-float">
                      <header
                        className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"
                        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
                      >
                        <div className="min-w-0">
                          <RadixDialog.Title className="font-display text-2xl font-semibold text-foreground">
                            {isEditing ? "Edit Expense" : "Add Expenses"}
                          </RadixDialog.Title>
                          <div aria-hidden="true" className="squiggle mt-1 w-14 text-accent/60" />
                        </div>

                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={
                                scanning ||
                                preparingPhotos ||
                                photos.length >= MAX_SLIP_PHOTOS
                              }
                              aria-label="Read a slip from a photo"
                              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold text-accent shadow-card transition-colors hover:bg-accent-soft disabled:opacity-50"
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

                      {/* The facts that hold for the whole trip, set once.
                          Dropped entirely while photos are waiting to be read,
                          where there is nothing yet to date and the read sets
                          it anyway. Rendered conditionally rather than with
                          the `hidden` attribute, which Tailwind's `flex` would
                          override. */}
                      {!hideBasket && (
                      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border bg-surface-sunk/70 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
                        {multiDay && dateRange ? (
                          <p className="flex h-11 items-center gap-2 px-1 text-[15px] font-medium text-foreground">
                            <CalendarRange className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <span className="sr-only">Dates</span>
                            {formatShortDate(dateRange.from)} – {formatShortDate(dateRange.to)}
                          </p>
                        ) : (
                          <label className="flex items-center gap-2">
                            <span className="sr-only">Date</span>
                            <input
                              type="date"
                              value={basketDate}
                              onChange={(e) => e.target.value && changeBasketDate(e.target.value)}
                              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-[15px] text-foreground outline-none focus:border-accent sm:w-44"
                            />
                          </label>
                        )}

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
                          {/* Opened from the camera button, with nothing typed
                              yet: the photo is the whole point, so it gets a
                              target you cannot miss. A file picker needs a real
                              tap to open, so this cannot be skipped for them. */}
                          {showCameraCard && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="graph-paper flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent/60 bg-accent-soft px-5 py-10 text-center transition-colors hover:bg-accent-soft/70"
                            >
                              <span className="porthole sea-fill mb-2 flex h-16 w-16 items-center justify-center rounded-full text-on-sea">
                                <Camera className="h-8 w-8" aria-hidden="true" />
                              </span>
                              <span className="font-display text-lg font-semibold text-foreground">
                                Take a photo of the slip
                              </span>
                              <span className="max-w-xs text-sm text-muted">
                                Or pick ones you already took. Written on both sides? Add
                                both before reading. You will check every line before it
                                saves.
                              </span>
                            </button>
                          )}

                          {photos.length > 0 && (
                            <SlipPhotoTray
                              photos={photos}
                              state={trayState}
                              full={photos.length >= MAX_SLIP_PHOTOS}
                              preparing={preparingPhotos}
                              readSummary={
                                needsCheck > 0
                                  ? `${needsCheck} of ${lines.length} lines need a look`
                                  : `${lines.length} lines read, none flagged`
                              }
                              onAdd={() => fileInputRef.current?.click()}
                              onRemove={removePhoto}
                              onRead={requestRead}
                              onView={setViewerIndex}
                            />
                          )}

                          {unreadable && (
                            <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
                              Couldn’t read part of it: {unreadable}
                            </p>
                          )}

                          {multiDay && !hideBasket && (
                            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
                              This slip covers {dateGroups.length} days. Tap a day to move
                              all of its lines, or the date on one line to move just that
                              line.
                            </p>
                          )}

                          {!hideBasket &&
                            dateGroups.map((group) => (
                            <section key={group.date} className="flex flex-col gap-2.5">
                              {multiDay && (
                                <div className="flex items-center gap-2 pt-1">
                                  <h3>
                                    <DateChip
                                      value={group.date}
                                      onChange={(next) =>
                                        moveLinesToDate(
                                          group.lines.map((line) => line.id),
                                          next
                                        )
                                      }
                                      label={`Change the date of all ${group.lines.length} lines on ${formatShortDate(group.date)}`}
                                      className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase"
                                    />
                                  </h3>
                                  <span className="h-px flex-1 border-t border-dashed border-border" />
                                  <span className="font-mono text-xs font-medium text-muted tabular-nums">
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
                                    onChange={(patch) => patchLine(line.id, patch)}
                                    onChangeDate={(next) => moveLinesToDate([line.id], next)}
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

                          {/* Hidden while a read is in flight: a line typed now
                              would be replaced without asking when it lands. */}
                          {!isEditing && !scanning && (
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
                            <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
                              The slip says {formatCurrency(statedTotal ?? 0)}, these lines
                              come to {formatCurrency(total)}. A line may be missing or
                              misread.
                            </p>
                          )}

                          {agreement === true && (
                            <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
                              Matches the slip’s own total of{" "}
                              {formatCurrency(statedTotal ?? 0)}.
                            </p>
                          )}

                          {error && (
                            <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                              {error}
                            </p>
                          )}
                        </div>
                      </div>

                      <footer
                        className="shrink-0 border-t border-dashed border-border bg-surface-sunk/70 px-5 py-4 sm:px-6"
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
                              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Total</p>
                              <p className="font-display text-2xl font-semibold text-foreground tabular-nums">
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
                        {viewerIndex !== null && photos.length > 0 && (
                          <SlipPhotoViewer
                            photos={photos}
                            startIndex={Math.min(viewerIndex, photos.length - 1)}
                            onClose={() => setViewerIndex(null)}
                          />
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
          laptop still shows its ordinary file chooser. `multiple` lets both
          sides of a page be picked from the library in one go; the camera
          still takes one at a time, which the tray's "Other side" covers. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) addPhotos(files);
        }}
      />

      <ConfirmDialog
        open={confirmingReplace}
        onOpenChange={setConfirmingReplace}
        title="Replace what you've added?"
        description="Reading the photos starts the list over, so the lines already here — and any corrections made to them — would be lost."
        confirmLabel={photos.length > 1 ? "Read the photos" : "Read the slip"}
        onConfirm={readPhotos}
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

/** Identifies a set of photos, in order, so a read can be matched to them. */
function photoKey(photos: SlipPhoto[]): string {
  return photos.map((photo) => photo.id).join(",");
}

function releasePhotos(photos: SlipPhoto[]) {
  for (const photo of photos) URL.revokeObjectURL(photo.url);
}
