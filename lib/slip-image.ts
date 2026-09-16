/**
 * Getting a phone photo into a shape the reader will take.
 *
 * This runs on the device, before upload, and it is doing three jobs at once
 * that all bite on an iPhone:
 *
 *  - **Format.** iPhones shoot HEIC. Safari usually hands a file input a JPEG
 *    instead, but not always, and which it does has moved between iOS
 *    versions. Re-encoding through a canvas settles it.
 *  - **Size.** A full-resolution phone photo runs well past the upload
 *    ceiling. A slip is text on paper: the long edge below is plenty to read
 *    handwriting from and a fraction of the bytes.
 *  - **The upload itself.** The app is used over a phone connection from a
 *    home screen icon. Sending two megabytes instead of twelve is the
 *    difference between a wait and a pause.
 *
 * If the browser cannot decode the file at all, the original is sent
 * untouched and the server decides — better a slow success or a clear
 * rejection than a photo silently dropped on the device.
 */

/** Long edge, in pixels. Enough to read handwriting, far below a phone's native size. */
export const MAX_PHOTO_EDGE = 2000;

/**
 * Photos of one slip that are read together: both sides of a page, or a
 * running list that spills onto a second sheet. Four covers two double-sided
 * pages; anything longer is two slips.
 */
export const MAX_SLIP_PHOTOS = 4;

/**
 * Bytes one photo may take, so that a full set of MAX_SLIP_PHOTOS still fits
 * the single upload they travel in (MAX_UPLOAD_BYTES in lib/slip-reader).
 */
export const PHOTO_BYTE_BUDGET = 1024 * 1024;

/**
 * Tried in order until the photo fits PHOTO_BYTE_BUDGET. Quality gives way
 * before resolution does: the reader needs the pen strokes more than it needs
 * clean JPEG blocks, and a slip photographed in good light usually fits at
 * the first step anyway.
 */
export const ENCODE_STEPS = [
  { maxEdge: MAX_PHOTO_EDGE, quality: 0.85 },
  { maxEdge: MAX_PHOTO_EDGE, quality: 0.7 },
  { maxEdge: 1600, quality: 0.7 },
] as const;

/** A photo waiting in the sheet's tray: the prepared file and a preview URL for it. */
export interface SlipPhoto {
  id: string;
  file: File;
  /** An object URL; whoever creates one revokes it. */
  url: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Scales dimensions so the longer edge is at most `maxEdge`, keeping the
 * aspect ratio. Anything already small enough is returned unchanged rather
 * than being upscaled.
 */
export function fitWithin(
  { width, height }: Dimensions,
  maxEdge: number = MAX_PHOTO_EDGE
): Dimensions {
  const longest = Math.max(width, height);

  if (longest <= maxEdge || longest === 0) {
    return { width, height };
  }

  const scale = maxEdge / longest;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };

    image.src = url;
  });
}

function encode(
  image: HTMLImageElement,
  { maxEdge, quality }: (typeof ENCODE_STEPS)[number]
): Promise<Blob | null> {
  const { width, height } = fitWithin(
    { width: image.naturalWidth, height: image.naturalHeight },
    maxEdge
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);

  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns a downscaled JPEG of the photo within PHOTO_BYTE_BUDGET where the
 * steps allow, or the original file if the browser could not decode it.
 */
export async function prepareSlipPhoto(file: File): Promise<File> {
  try {
    const image = await decode(file);
    let encoded: Blob | null = null;

    for (const step of ENCODE_STEPS) {
      const blob = await encode(image, step);
      if (!blob) break;

      encoded = blob;
      if (blob.size <= PHOTO_BYTE_BUDGET) break;
    }

    if (!encoded) return file;

    return new File([encoded], "slip.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
