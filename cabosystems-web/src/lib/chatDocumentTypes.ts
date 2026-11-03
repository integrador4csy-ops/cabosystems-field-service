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
      primaryColor: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
      canPreviewInApp: true,
    };
  }

  // 2. Word
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
      primaryColor: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      canPreviewInApp: true,
    };
  }

  // 3. Excel
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
      primaryColor: '#16A34A',
      bgColor: '#F0FDF4',
      borderColor: '#BBF7D0',
      canPreviewInApp: true,
    };
  }

  // 4. PowerPoint
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
      primaryColor: '#EA580C',
      bgColor: '#FFF7ED',
      borderColor: '#FED7AA',
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
      primaryColor: '#9333EA',
      bgColor: '#FAF5FF',
      borderColor: '#E9D5FF',
      canPreviewInApp: true,
    };
  }

  // 6. Archivos comprimidos / ZIP
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed')
  ) {
    return {
      extension: ext || 'zip',
      category: 'archive',
      badgeLabel: ext.toUpperCase() || 'ZIP',
      typeName: 'Archivo comprimido',
      primaryColor: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
      canPreviewInApp: false,
    };
  }

  // 7. Texto / Código
  if (
    ['txt', 'log', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sql', 'md'].includes(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/json'
  ) {
    return {
      extension: ext || 'txt',
      category: 'text',
      badgeLabel: ext.toUpperCase() || 'TXT',
      typeName: 'Documento de texto',
      primaryColor: '#475569',
      bgColor: '#F8FAFC',
      borderColor: '#E2E8F0',
      canPreviewInApp: true,
    };
  }

  // 8. Genérico
  return {
    extension: ext || 'file',
    category: 'generic',
    badgeLabel: ext ? ext.toUpperCase().slice(0, 4) : 'DOC',
    typeName: 'Archivo',
    primaryColor: '#0D9488',
    bgColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    canPreviewInApp: true,
  };
}
