const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_DIMENSION = 1600;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function taskProgressRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la fotografía.')); };
    image.src = url;
  });
}

/** Normalizes supported input to a bounded JPEG before private upload. */
export async function prepareTaskEvidence(file: File): Promise<Blob> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Usa una fotografía JPEG, PNG o WebP.');
  const { image, url } = await loadImage(file);
  try {
    const ratio = Math.min(1, MAX_EVIDENCE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la fotografía.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo comprimir la fotografía.')), 'image/jpeg', 0.75));
    if (blob.size > MAX_EVIDENCE_BYTES) throw new Error('La fotografía supera el límite de 10 MB.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
