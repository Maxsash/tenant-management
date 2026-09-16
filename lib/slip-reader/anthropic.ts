import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { buildSlipSystemPrompt } from "@/lib/slip-prompt";
import { buildSlipUserPrompt, SlipExtractionSchema } from "./schema";
import type { ReadSlipOptions, SlipReader } from "./types";
import type { SlipExtraction } from "@/types/slip";

/**
 * Reads a slip through the Anthropic API. Better at handwritten Devanagari
 * than the free Gemini path and it does not train on what it is sent, but it
 * bills per call — a Claude Pro subscription does not include API credits.
 * Kept as the preferred reader when a key happens to be configured.
 */

export const ANTHROPIC_MODEL = "claude-opus-5";

/** No HEIC here, unlike Gemini — the Messages API does not decode it. */
export const ANTHROPIC_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const anthropicReader: SlipReader = {
  name: "anthropic",
  imageTypes: ANTHROPIC_IMAGE_TYPES,
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  missingKeyMessage:
    "Slip reading is not set up: ANTHROPIC_API_KEY is missing from the server environment.",
  read: readWithAnthropic,
};

async function readWithAnthropic({
  images,
  categories,
  items,
  today,
}: ReadSlipOptions): Promise<SlipExtraction> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    // Dense, ambiguous handwriting in a second script repays thinking.
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSlipSystemPrompt(categories, items, today),
        // Identical between slips photographed in one sitting.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image.mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: image.base64,
            },
          })),
          { type: "text", text: buildSlipUserPrompt(images.length) },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(SlipExtractionSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read this image.");
  }

  if (!response.parsed_output) {
    throw new Error("Could not read a slip out of that photo.");
  }

  return response.parsed_output;
}
