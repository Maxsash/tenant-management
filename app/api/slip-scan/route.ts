import { getExpenseCategories, getExpenseItems } from "@/lib/db";
import { hasUserSession } from "@/lib/admin-auth";
import { currentDate } from "@/lib/date";
import { MAX_SLIP_PHOTOS } from "@/lib/slip-image";
import { buildSlipDraft } from "@/lib/slip-matching";
import {
  isSlipReadingConfigured,
  isSupportedImageType,
  MAX_UPLOAD_BYTES,
  missingKeyMessage,
  readSlip,
  supportedImageTypes,
} from "@/lib/slip-reader";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";
import { NextResponse } from "next/server";

/**
 * Photographs of a slip in, draft rows out. Nothing is written to the database
 * here — the answer goes to the review screen, and only what the person
 * confirms there reaches /api/expenses/bulk.
 *
 * Takes one or more photos as repeated `image` fields, in the order they were
 * taken. Several photos are one slip — usually both sides of a page — and are
 * read in one request, so dates carry from one side to the other.
 *
 * Gated at user level, unlike creating an expense. Two reasons: the reply is
 * a reading of the household's spending (the same thing GET /api/expenses
 * withholds), and every call spends a request at whichever provider is
 * configured.
 */

/**
 * The reader keeps itself well under a minute (GEMINI_TIMING), because the
 * phone will not wait much longer. This only has to stop the host cutting it
 * off sooner; 60 is also the most a Vercel Hobby function without fluid
 * compute may ask for, so it deploys either way.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasUserSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  if (!isSlipReadingConfigured()) {
    return NextResponse.json({ error: missingKeyMessage() }, { status: 501 });
  }

  let files: File[];

  try {
    const form = await req.formData();

    files = form
      .getAll("image")
      .filter((candidate): candidate is File => candidate instanceof File);
  } catch {
    return NextResponse.json({ error: "Malformed upload" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No photo attached" }, { status: 400 });
  }

  if (files.length > MAX_SLIP_PHOTOS) {
    return NextResponse.json(
      { error: `One slip can be read from at most ${MAX_SLIP_PHOTOS} photos.` },
      { status: 400 }
    );
  }

  if (files.some((file) => !isSupportedImageType(file.type))) {
    return NextResponse.json(
      {
        error: `That file is not a photo the reader accepts (${supportedImageTypes().join(", ")}).`,
      },
      { status: 415 }
    );
  }

  if (files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error:
          files.length > 1
            ? "Those photos are too large to send together — remove one, or take them again."
            : "That photo is too large — take it again at a smaller size.",
      },
      { status: 413 }
    );
  }

  const [categories, items, images] = await Promise.all([
    getExpenseCategories<ExpenseCategory>(),
    getExpenseItems<ExpenseItem>(),
    Promise.all(
      files.map(async (file) => ({
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType: file.type,
      }))
    ),
  ]);

  const today = currentDate();

  try {
    const extraction = await readSlip({ images, categories, items, today });

    const draft = buildSlipDraft(extraction, { items, categories, today });

    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read that slip" },
      { status: 502 }
    );
  }
}
