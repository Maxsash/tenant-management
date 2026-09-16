import type { ExpenseCategory, ExpenseItem } from "@/types/expense";
import type { SlipExtraction } from "@/types/slip";

/** One photograph, ready to hand to a provider. */
export interface SlipImage {
  base64: string;
  mediaType: string;
}

export interface ReadSlipOptions {
  /**
   * Every photo of one slip, in the order they were taken — usually the front
   * and back of a page. They are read in a single request rather than one each
   * so a date written on the front carries onto the back, and a total on the
   * back can be checked against lines on the front.
   */
  images: SlipImage[];
  categories: ExpenseCategory[];
  items: ExpenseItem[];
  today: string;
}

/**
 * One way of turning photographs into slip lines. Providers differ in what
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
