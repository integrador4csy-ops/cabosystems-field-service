/**
 * Descarga directamente un archivo remoto en el navegador forzando la descarga local
 * mediante Blob, evitando que el navegador abra una pestaña de visualización (PDF/imagen).
 */
export async function downloadRemoteFile(url: string, fileName?: string | null): Promise<void> {
  const cleanName = fileName || url.split('/').pop()?.split('?')[0] || 'archivo';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to anchor download:', err);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
