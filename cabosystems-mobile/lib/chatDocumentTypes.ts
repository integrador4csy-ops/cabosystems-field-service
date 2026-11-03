export type DocumentCategory =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'image'
  | 'archive'
  | 'text'
  | 'generic';

export interface DocumentInfo {
  extension: string;
  category: DocumentCategory;
  badgeLabel: string;
  typeName: string;
  primaryColor: string;
  bgColor: string;
  borderColor: string;
  canPreviewInApp: boolean;
}

/**
 * Extrae la extensión limpia de un nombre de archivo o URL
 */
export function extractFileExtension(fileNameOrUrl?: string | null): string {
  if (!fileNameOrUrl) return '';
  const clean = fileNameOrUrl.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

/**
 * Identifica el tipo de documento, colores, etiquetas y capacidad de vista previa
 */
export function getDocumentInfo(
  fileName?: string | null,
  mimeType?: string | null,
  url?: string | null
): DocumentInfo {
  const ext = extractFileExtension(fileName) || extractFileExtension(url);
  const mime = (mimeType || '').toLowerCase();

  // 1. PDF
  if (ext === 'pdf' || mime === 'application/pdf' || mime.includes('/pdf')) {
    return {
      extension: 'pdf',
      category: 'pdf',
      badgeLabel: 'PDF',
      typeName: 'Documento PDF',
      primaryColor: '#DC2626', // Red-600
      bgColor: '#FEF2F2', // Red-50
      borderColor: 'rgba(220, 38, 38, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 2. Word / Documentos de texto enriquecido
  if (
    ['doc', 'docx', 'rtf', 'odt', 'dot', 'dotx'].includes(ext) ||
    mime.includes('word') ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      extension: ext || 'docx',
      category: 'word',
      badgeLabel: ext.toUpperCase() || 'DOCX',
      typeName: 'Documento Word',
      primaryColor: '#2563EB', // Blue-600
      bgColor: '#EFF6FF', // Blue-50
      borderColor: 'rgba(37, 99, 235, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 3. Excel / Hojas de cálculo
  if (
    ['xls', 'xlsx', 'csv', 'tsv', 'ods', 'xlsm'].includes(ext) ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'text/csv'
  ) {
    return {
      extension: ext || 'xlsx',
      category: 'excel',
      badgeLabel: ext.toUpperCase() || 'XLSX',
      typeName: ext === 'csv' ? 'Archivo CSV' : 'Hoja de cálculo Excel',
      primaryColor: '#16A34A', // Green-600
      bgColor: '#F0FDF4', // Green-50
      borderColor: 'rgba(22, 163, 74, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 4. PowerPoint / Presentaciones
  if (
    ['ppt', 'pptx', 'odp', 'pps', 'ppsx'].includes(ext) ||
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return {
      extension: ext || 'pptx',
      category: 'powerpoint',
      badgeLabel: ext.toUpperCase() || 'PPTX',
      typeName: 'Presentación',
      primaryColor: '#EA580C', // Orange-600
      bgColor: '#FFF7ED', // Orange-50
      borderColor: 'rgba(234, 88, 12, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 5. Imágenes enviadas como archivo
  if (
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return {
      extension: ext || 'img',
      category: 'image',
      badgeLabel: ext.toUpperCase() || 'IMG',
      typeName: 'Imagen',
      primaryColor: '#9333EA', // Purple-600
      bgColor: '#FAF5FF', // Purple-50
      borderColor: 'rgba(147, 51, 234, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 6. Archivos comprimidos / ZIP
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return {
      extension: ext || 'zip',
      category: 'archive',
      badgeLabel: ext.toUpperCase() || 'ZIP',
      typeName: 'Archivo comprimido',
      primaryColor: '#D97706', // Amber-600
      bgColor: '#FFFBEB', // Amber-50
      borderColor: 'rgba(217, 119, 6, 0.25)',
      canPreviewInApp: false,
    };
  }

  // 7. Texto / Código / Datos
  if (
    ['txt', 'log', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sql', 'md'].includes(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml'
  ) {
    return {
      extension: ext || 'txt',
      category: 'text',
      badgeLabel: ext.toUpperCase() || 'TXT',
      typeName: 'Documento de texto',
      primaryColor: '#475569', // Slate-600
      bgColor: '#F8FAFC', // Slate-50
      borderColor: 'rgba(71, 85, 105, 0.25)',
      canPreviewInApp: true,
    };
  }

  // 8. Archivo genérico
  return {
    extension: ext || 'file',
    category: 'generic',
    badgeLabel: (ext ? ext.toUpperCase().slice(0, 4) : 'DOC'),
    typeName: 'Archivo',
    primaryColor: '#0D9488', // Teal-600
    bgColor: '#F0FDFA', // Teal-50
    borderColor: 'rgba(13, 148, 136, 0.25)',
    canPreviewInApp: true,
  };
}
