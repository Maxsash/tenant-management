"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";

import Button from "@/components/ui/Button";
import WaveBand from "@/components/ui/sea/WaveBand";
import type { SlipPhoto } from "@/lib/slip-image";

/**
 * - `staged`: photos taken, not yet read — more can be added first.
 * - `reading`: on their way to the reader.
 * - `read`: the lines below came from exactly these photos.
 */
export type SlipPhotoTrayState = "staged" | "reading" | "read";

type TrayProps = {
  photos: SlipPhoto[];
  state: SlipPhotoTrayState;
  /** The tray holds as many photos as one slip may have. */
  full: boolean;
  /** A just-picked photo is still being shrunk on the device. */
  preparing: boolean;
  /** What the read found, shown once it has. */
  readSummary: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRead: () => void;
  onView: (index: number) => void;
};

/**
 * The photos of the slip being logged.
 *
 * Taking a photo no longer starts the read on its own. A page is often written
 * on both sides, and reading the front alone would lose the back — or, read as
 * a second slip, would drop its undated lines onto today, since the date that
 * covers them is on the other side. So photos wait here until the person says
 * that is all of them, and are then read together as one slip.
 */
export function SlipPhotoTray({
  photos,
  state,
  full,
  preparing,
  readSummary,
  onAdd,
  onRemove,
  onRead,
  onView,
}: TrayProps) {
  if (state === "reading") {
    return (
      <div className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-accent-soft px-4 pt-6 pb-14 text-center">
        <div className="flex justify-center gap-2">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="h-28 w-20 rounded-lg border border-border object-cover opacity-70"
            />
          ))}
        </div>
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          {photos.length > 1 ? `Reading ${photos.length} photos…` : "Reading the slip…"}
        </p>
        {/* Honest about the wait, which runs to tens of seconds when Google is
            busy: an unexplained spinner that long reads as broken on a phone. */}
        <p className="text-xs text-muted">
          Usually under half a minute. Keep the app open until it finishes.
        </p>
        <WaveBand
          band="near"
          water="color-mix(in oklab, var(--color-accent) 22%, transparent)"
          crest="color-mix(in oklab, var(--color-accent) 12%, transparent)"
          drift="10s"
          heave="4s"
          lift="3px"
          fillBelow
          className="-bottom-4 -z-10"
        />
      </div>
    );
  }

  if (state === "read") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2">
        <button
          type="button"
          onClick={() => onView(0)}
          className="relative shrink-0"
          aria-label={photos.length > 1 ? "View the slip photos" : "View the slip photo"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0].url}
            alt=""
            className="h-14 w-14 rounded-lg border border-border object-cover"
          />
          {photos.length > 1 && (
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-accent px-1.5 font-mono text-[11px] font-semibold text-on-accent">
              {photos.length}
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{readSummary}</p>
          <div className="flex flex-wrap items-center gap-x-3 text-xs font-medium text-accent">
            <button
              type="button"
              onClick={() => onView(0)}
              className="min-h-7 underline-offset-2 hover:underline"
            >
              Check against the slip
            </button>
            {!full && (
              <button
                type="button"
                onClick={onAdd}
                disabled={preparing}
                className="flex min-h-7 items-center gap-1 underline-offset-2 hover:underline disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add a photo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Photos of the slip"
      className="graph-paper rounded-2xl border border-border bg-background p-3"
    >
      <ul className="flex flex-wrap gap-3 pt-2 pr-2">
        {photos.map((photo, index) => (
          <li key={photo.id} className="relative">
            <button
              type="button"
              onClick={() => onView(index)}
              aria-label={`View photo ${index + 1}`}
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-28 w-20 rounded-lg border border-border object-cover shadow-card"
              />
            </button>
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 left-1.5 rounded-full bg-sea-abyss/75 px-1.5 font-mono text-[11px] font-semibold text-on-sea"
            >
              {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition-colors hover:text-danger"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}

        {!full && (
          <li>
            <button
              type="button"
              onClick={onAdd}
              disabled={preparing}
              className="flex h-28 w-20 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-accent/60 bg-surface px-1 text-center text-xs font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
            >
              {preparing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-5 w-5" aria-hidden="true" />
              )}
              {photos.length === 1 ? "Other side" : "Add photo"}
            </button>
          </li>
        )}
      </ul>

      <p className="mt-3 text-sm text-muted">
        {photos.length === 1
          ? "Written on the back too? Add that side now, and both are read together as one slip."
          : `These ${photos.length} photos are read together as one slip, in this order.`}
      </p>

      <Button onClick={onRead} disabled={preparing} className="mt-3 w-full">
        {photos.length > 1 ? `Read ${photos.length} photos` : "Read the slip"}
      </Button>
    </section>
  );
}

type ViewerProps = {
  photos: SlipPhoto[];
  startIndex: number;
  onClose: () => void;
};

/**
 * The photos full-screen, for checking the read against the paper. Swipes
 * between photos on a phone; the arrows are for a laptop. A tap on the photo
 * closes it, as it always has.
 */
export function SlipPhotoViewer({ photos, startIndex, onClose }: ViewerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (scroller) scroller.scrollLeft = startIndex * scroller.clientWidth;
  }, [startIndex]);

  function goTo(next: number) {
    const scroller = scrollerRef.current;

    scroller?.scrollTo({ left: next * scroller.clientWidth, behavior: "smooth" });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Slip photos"
      className="absolute inset-0 z-20 flex flex-col bg-sea-abyss/95 text-on-sea"
    >
      <div
        className="flex shrink-0 items-center justify-between px-4 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <span className="font-mono text-xs tracking-[0.14em] uppercase">
          {photos.length > 1 ? `Photo ${index + 1} of ${photos.length}` : "The slip"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the photo"
          className="rounded-full p-2 transition-colors hover:bg-on-sea/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={(e) =>
          setIndex(
            Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth))
          )
        }
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={onClose}
            aria-label="Close the photo"
            className="flex h-full w-full shrink-0 snap-center items-center justify-center p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Photo ${i + 1} of the slip`}
              className="max-h-full max-w-full object-contain"
            />
          </button>
        ))}
      </div>

      {photos.length > 1 && (
        <div
          className="flex shrink-0 items-center justify-center gap-6 py-2"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous photo"
            className="rounded-full p-2 transition-colors hover:bg-on-sea/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === photos.length - 1}
            aria-label="Next photo"
            className="rounded-full p-2 transition-colors hover:bg-on-sea/10 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
