export const MAX_EVIDENCE_DIMENSION = 1600;
export function evidencePhotoSize(width: number, height: number) {
  const ratio = Math.min(1, MAX_EVIDENCE_DIMENSION / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
/** Bound resolution as well as JPEG quality; never upscale a small photograph. */
export async function optimizeEvidencePhoto(uri: string): Promise<string> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(uri, { maxWidth: MAX_EVIDENCE_DIMENSION, maxHeight: MAX_EVIDENCE_DIMENSION });
  let original: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let resized: typeof original;
  try {
    original = await context.renderAsync();
    const size = evidencePhotoSize(original.width, original.height);
    if (size.width !== original.width || size.height !== original.height) {
      context.resize(size);
      resized = await context.renderAsync();
    }
    return (await (resized || original).saveAsync({ format: SaveFormat.JPEG, compress: 0.75 })).uri;
  } finally {
    resized?.release(); original?.release(); context.release();
  }
}
