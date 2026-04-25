/**
 * Crop a PNG blob (typically a rendered PDF page) to a rectangle
 * defined in PDF user-space coordinates (pdfjs bottom-up y-axis).
 *
 * Used by the Stage 2 AI-vision fallback: when Stage 1 text extraction
 * isn't confident, we crop the detected title-block region from the
 * rendered page image and feed the crop to the `classify-drawing`
 * Gemini endpoint. A tiny focused crop is dramatically more accurate
 * than a full ARCH-D page (which can be 4800×7200 px).
 *
 * Coordinate translation:
 *   - Input region is in PDF points, y measured from page BOTTOM
 *   - Output crop is pixels, y measured from page TOP (image convention)
 *   - Scale between them: imagePixels / pdfPoints
 */

export interface Region {
  /** Lower-left X in pdfjs coords */
  x: number;
  /** Lower-left Y in pdfjs coords (0 at bottom) */
  y: number;
  /** Width in pdfjs user-space units */
  w: number;
  /** Height in pdfjs user-space units */
  h: number;
}

/**
 * Crop a PNG blob to a region defined in PDF coordinates.
 *
 * @param sourcePng   full-page PNG blob (from pdfPageSplitter)
 * @param region      bounds in pdfjs PDF-points, bottom-up y-axis
 * @param pdfWidth    source page width in PDF points
 * @param pdfHeight   source page height in PDF points
 * @returns           PNG blob of just the cropped region
 */
export async function cropPngToRegion(
  sourcePng: Blob,
  region: Region,
  pdfWidth: number,
  pdfHeight: number,
): Promise<Blob> {
  // Decode the source PNG into an ImageBitmap so we can drawImage from it
  const bitmap = await createImageBitmap(sourcePng);

  try {
    const imgW = bitmap.width;
    const imgH = bitmap.height;

    // Compute pixel coordinates of the crop window.
    // pdf-to-image scaling is isotropic in practice (pdfPageSplitter uses
    // one scale factor), but we compute X and Y independently for safety.
    const scaleX = imgW / pdfWidth;
    const scaleY = imgH / pdfHeight;

    // Source rect in image pixels. Y flip: the TOP of the PDF-space
    // rectangle sits at pdfY + h; in image space that becomes
    // imgH - (pdfY + pdfH) * scaleY.
    const srcX = Math.max(0, Math.round(region.x * scaleX));
    const srcYTop = Math.max(0, Math.round(imgH - (region.y + region.h) * scaleY));
    const srcW = Math.min(imgW - srcX, Math.round(region.w * scaleX));
    const srcH = Math.min(imgH - srcYTop, Math.round(region.h * scaleY));

    if (srcW <= 0 || srcH <= 0) {
      throw new Error(`Crop region produced zero-size output (${srcW}×${srcH})`);
    }

    // Render into an OffscreenCanvas sized to the crop dimensions.
    // Pattern matches src/lib/pdfPageSplitter.ts thumbnail generation.
    const canvas = new OffscreenCanvas(srcW, srcH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for crop');

    // Draw the source-rect into the whole destination canvas
    ctx.drawImage(
      bitmap,
      srcX, srcYTop, srcW, srcH,   // source rect
      0, 0, srcW, srcH,            // destination rect (full canvas)
    );

    const output = await canvas.convertToBlob({ type: 'image/png' });

    // Release the canvas backing memory — OffscreenCanvas doesn't always
    // auto-GC in all browsers
    canvas.width = 0;
    canvas.height = 0;

    return output;
  } finally {
    bitmap.close();
  }
}
