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

/** JPEG quality. High enough that thin pen strokes survive. */
export const PHOTO_QUALITY = 0.85;

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

/**
 * Returns a downscaled JPEG of the photo, or the original file if the browser
 * could not decode it.
 */
export async function prepareSlipPhoto(file: File): Promise<File> {
  try {
    const image = await decode(file);
    const { width, height } = fitWithin({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY)
    );

    if (!blob) return file;

    return new File([blob], "slip.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
