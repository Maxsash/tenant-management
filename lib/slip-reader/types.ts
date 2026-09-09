import type { ExpenseCategory, ExpenseItem } from "@/types/expense";
import type { SlipExtraction } from "@/types/slip";

export interface ReadSlipOptions {
  base64Image: string;
  mediaType: string;
  categories: ExpenseCategory[];
  items: ExpenseItem[];
  today: string;
}

/**
 * One way of turning a photograph into slip lines. Providers differ in what
 * they cost, what image formats they decode and how well they read
 * handwriting — nothing else about the flow depends on which is in use.
 */
export interface SlipReader {
  name: string;
  /** MIME types this provider decodes. */
  imageTypes: readonly string[];
  isConfigured: () => boolean;
  /** Shown verbatim when the key is missing, so it names the variable to set. */
  missingKeyMessage: string;
  read: (options: ReadSlipOptions) => Promise<SlipExtraction>;
}
