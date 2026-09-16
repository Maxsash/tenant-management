import { GoogleGenAI } from "@google/genai";

import { buildSlipSystemPrompt } from "@/lib/slip-prompt";
import { RaceExhaustedError, staggeredRace } from "./race";
import {
  buildSlipUserPrompt,
  SlipExtractionSchema,
  slipJsonSchema,
} from "./schema";
import type { ReadSlipOptions, SlipReader } from "./types";
import type { SlipExtraction } from "@/types/slip";

/**
 * Reads a slip through Google's Gemini API.
 *
 * This is the free path: Gemini's free tier is indefinite, needs no card, and
 * covers the Flash models. Two consequences worth keeping in view rather than
 * discovering later:
 *
 *  - **Flash is not a frontier model.** It reads handwritten Devanagari less
 *    reliably than the Anthropic reader does. That is affordable only because
 *    nothing here is saved without a person confirming it on the review
 *    screen, and because the slip's own total is checked against the lines.
 *  - **The free tier trains on what you send it.** Google's paid tier and
 *    Vertex do not; the free one may. Every slip photographed through this
 *    reader is household spending handed to Google on those terms.
 */

/**
 * Tried in this order, staggered (see GEMINI_TIMING). All are free-tier
 * eligible; Pro-class Gemini models are paid-only.
 *
 * There is more than one because the free tier really does run out of
 * capacity, and someone standing in their kitchen with a slip should not have
 * to care. A different model usually has room when one does not.
 *
 * The order is by what actually answers, not by what is newest. Measured on
 * 16 September 2026 against the same test page:
 *
 *  - `gemini-3.6-flash` read it correctly in 9 seconds, twice.
 *  - `gemini-3.5-flash` read it in 9 seconds once, and was busy once.
 *  - `gemini-3.8-flash`, the newest, was busy every time — and took 100 and
 *    149 seconds to say so. Leading with it is what broke scanning: the phone
 *    gave up ("Load failed") before the list ever moved on. It stays in the
 *    list, third, in case its capacity recovers.
 *  - `gemini-3.5-flash-lite` answered in 3 seconds, but a Lite model reads
 *    handwriting least well, so it is the last resort.
 *
 * Worth re-measuring when this list next changes; see test/manual/README.md.
 */
export const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
] as const;

/**
 * How long each model gets before the next one starts alongside it, and when
 * to give up on all of them.
 *
 * The deadline is set by the phone, not by Gemini. A phone browser does not
 * wait indefinitely for an answer — the 100-second hangs above reached the
 * person as Safari's "Load failed" — and the upload eats into whatever it does
 * allow, so the whole read is kept well under a minute.
 *
 * Measured on the same day, a healthy read took 10 seconds for a 7-line page
 * and 29–34 seconds for 25 lines over two photos. So a short slip rarely
 * starts a second model, while a long one usually does: that spends a little
 * more of the free quota, and is the price of never waiting out a hang. The
 * stagger still leaves room for all four to start before the deadline.
 */
export const GEMINI_TIMING = {
  staggerMs: 12_000,
  deadlineMs: 45_000,
} as const;

/** Gemini decodes HEIC/HEIF directly, which is what an iPhone shoots. */
export const GEMINI_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/**
 * Whether a failure is worth trying another model for. Capacity, rate limits
 * and server faults are; a bad key or a malformed request would fail the same
 * way on every model, so those surface immediately.
 */
export function isTransientGeminiError(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;

  if (typeof status === "number" && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);

  return /"code"\s*:\s*(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL/.test(
    message
  );
}

export const geminiReader: SlipReader = {
  name: "gemini",
  imageTypes: GEMINI_IMAGE_TYPES,
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  missingKeyMessage:
    "Slip reading is not set up: GEMINI_API_KEY is missing from the server environment.",
  read: readWithGemini,
};

async function readWithGemini(options: ReadSlipOptions): Promise<SlipExtraction> {
  try {
    return await staggeredRace(
      GEMINI_MODELS.map((model) => (signal) => readWithModel(model, options, signal)),
      { ...GEMINI_TIMING, isRetryable: isTransientGeminiError }
    );
  } catch (error) {
    if (!(error instanceof RaceExhaustedError)) throw error;

    // A long two-sided slip took over half a minute on a healthy model, so
    // running out of time is not always a busy Google, and the way round it
    // is different: fewer lines per read.
    throw new Error(
      error.reason === "deadline"
        ? "Reading the slip took too long. Try again in a minute — and if the slip is very long, read it a page at a time."
        : "Google's free tier is too busy to read the slip right now. Try again in a minute, or enter the lines by hand.",
      { cause: error }
    );
  }
}

async function readWithModel(
  model: string,
  { images, categories, items, today }: ReadSlipOptions,
  signal: AbortSignal
): Promise<SlipExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    model,
    contents: [
      ...images.map((image) => ({
        inlineData: { data: image.base64, mimeType: image.mediaType },
      })),
      { text: buildSlipUserPrompt(images.length) },
    ],
    config: {
      systemInstruction: buildSlipSystemPrompt(categories, items, today),
      responseMimeType: "application/json",
      responseJsonSchema: slipJsonSchema(),
      // Reading handwriting is a transcription task, not a creative one.
      temperature: 0,
      // Lets a model that lost the race stop waiting. Google still counts the
      // request against the free quota, which is the price of not hanging.
      abortSignal: signal,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("The slip reader returned nothing for that photo.");
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The slip reader's answer was not readable.");
  }

  // Schema-constrained output is still checked: a caller about to write rows
  // to the database should never be handed a half-parsed slip.
  const parsed = SlipExtractionSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("The slip reader's answer did not fit the expected shape.");
  }

  return parsed.data;
}
