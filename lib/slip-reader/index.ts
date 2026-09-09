import { anthropicReader } from "./anthropic";
import { geminiReader } from "./gemini";
import type { ReadSlipOptions, SlipReader } from "./types";
import type { SlipExtraction } from "@/types/slip";

export type { ReadSlipOptions, SlipReader } from "./types";
export { SlipExtractionSchema, slipJsonSchema } from "./schema";
export { GEMINI_MODELS, GEMINI_IMAGE_TYPES, isTransientGeminiError } from "./gemini";
export { ANTHROPIC_MODEL, ANTHROPIC_IMAGE_TYPES } from "./anthropic";

/**
 * Choosing who reads the slip.
 *
 * In preference order, first one whose key is set wins. Anthropic goes first
 * because it reads this handwriting better; Gemini is the one that is actually
 * free, and in practice the one that runs here.
 */
export const SLIP_READERS: SlipReader[] = [anthropicReader, geminiReader];

/** Comfortably under both providers' inline-image limits. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function getSlipReader(): SlipReader | null {
  return SLIP_READERS.find((reader) => reader.isConfigured()) ?? null;
}

export function isSlipReadingConfigured(): boolean {
  return getSlipReader() !== null;
}

/**
 * Every image type any configured reader accepts. Used to reject a file
 * before spending a call on it — the phone normalises photos to JPEG before
 * upload anyway, so this is a backstop rather than the usual path.
 */
export function supportedImageTypes(): readonly string[] {
  const reader = getSlipReader();

  return reader ? reader.imageTypes : [];
}

export function isSupportedImageType(type: string): boolean {
  return supportedImageTypes().includes(type);
}

/** Names every variable that would switch slip reading on, for the error message. */
export function missingKeyMessage(): string {
  return SLIP_READERS.map((reader) => reader.missingKeyMessage).join(" Or: ");
}

export async function readSlipImage(
  options: ReadSlipOptions
): Promise<SlipExtraction> {
  const reader = getSlipReader();

  if (!reader) throw new Error(missingKeyMessage());

  return reader.read(options);
}
