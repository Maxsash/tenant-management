import { GoogleGenAI } from "@google/genai";

import { buildSlipSystemPrompt } from "@/lib/slip-prompt";
import {
  SLIP_USER_PROMPT,
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
 * Tried in order. All are free-tier eligible (Pro-class Gemini models are
 * paid-only), newest and most capable first.
 *
 * There is more than one because the free tier really does run out of
 * capacity: the newest Flash model returns `503 UNAVAILABLE` under load often
 * enough to hit on an ordinary evening, and someone standing in their kitchen
 * with a slip should not have to care. A different model usually has room
 * when one does not, so a capacity failure moves down the list rather than
 * waiting and retrying the same one.
 */
export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;

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
  let lastTransient: unknown;

  for (const model of GEMINI_MODELS) {
    try {
      return await readWithModel(model, options);
    } catch (error) {
      if (!isTransientGeminiError(error)) throw error;

      lastTransient = error;
    }
  }

  throw new Error(
    "Google's free tier is busy right now and could not read the slip. Try again in a minute, or enter the lines by hand.",
    { cause: lastTransient }
  );
}

async function readWithModel(
  model: string,
  { base64Image, mediaType, categories, items, today }: ReadSlipOptions
): Promise<SlipExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    model,
    contents: [
      { inlineData: { data: base64Image, mimeType: mediaType } },
      { text: SLIP_USER_PROMPT },
    ],
    config: {
      systemInstruction: buildSlipSystemPrompt(categories, items, today),
      responseMimeType: "application/json",
      responseJsonSchema: slipJsonSchema(),
      // Reading handwriting is a transcription task, not a creative one.
      temperature: 0,
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
