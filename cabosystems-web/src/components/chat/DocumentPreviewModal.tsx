import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileImage,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { getDocumentInfo } from '../../lib/chatDocumentTypes';
import { downloadRemoteFile } from '../../lib/fileDownload';

export interface DocumentPreviewModalProps {
  url: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  url,
  fileName,
  fileSize,
  mimeType,
  onClose,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const docInfo = getDocumentInfo(fileName, mimeType, url);

  useEffect(() => {
    if (url) {
      setLoading(true);
      setHasError(false);
    }
  }, [url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!url) return null;

  const displayName = fileName || docInfo.typeName || t('Documento');
  const formattedSize = fileSize
    ? fileSize > 1024 * 1024
      ? (fileSize / (1024 * 1024)).toFixed(1) + ' MB'
      : (fileSize / 1024).toFixed(0) + ' KB'
    : '';

  const renderIcon = (size = 20) => {
    switch (docInfo.category) {
      case 'excel':
        return <FileSpreadsheet size={size} style={{ color: docInfo.primaryColor }} />;
      case 'archive':
        return <FileArchive size={size} style={{ color: docInfo.primaryColor }} />;
      case 'image':
        return <FileImage size={size} style={{ color: docInfo.primaryColor }} />;
      case 'text':
        return <FileCode size={size} style={{ color: docInfo.primaryColor }} />;
      default:
        return <FileText size={size} style={{ color: docInfo.primaryColor }} />;
    }
  };

  const isPdf = docInfo.category === 'pdf';
  const isImage = docInfo.category === 'image';
  const isOffice = ['word', 'excel', 'powerpoint'].includes(docInfo.category);
  const isRemote = url.startsWith('http://') || url.startsWith('https://');

  // For PDF, browsers natively render them in iframe / embed.
  // For Office, Google Docs Viewer provides a remote web view.
  const previewSource = isPdf
    ? `${url}#toolbar=1&navpanes=0`
    : isOffice && isRemote
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all duration-200 ${
          isMaximized
            ? 'w-full h-full max-w-none rounded-none'
            : 'w-full max-w-5xl h-[88vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/90 shrink-0 gap-3">
          {/* Document Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs"
              style={{ backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor }}
            >
              {renderIcon(20)}
              <span
                className="absolute -bottom-1 px-1 py-0.2 rounded text-[7px] font-bold text-white uppercase tracking-wider"
                style={{ backgroundColor: docInfo.primaryColor }}
              >
                {docInfo.badgeLabel}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-800 truncate" title={displayName}>
                {displayName}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {docInfo.typeName}
                {formattedSize ? ` • ${formattedSize}` : ''}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title={isMaximized ? t('Restaurar') : t('Pantalla completa')}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              title={t('Abrir en pestaña nueva')}
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={() => void downloadRemoteFile(url, displayName)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title={t('Descargar archivo')}
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title={t('Cerrar (Esc)')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="relative flex-1 bg-slate-100 overflow-hidden flex items-center justify-center">
          {/* Loading Overlay */}
          {loading && !hasError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 gap-2">
              <Loader2 size={32} className="animate-spin text-brand-500" />
              <p className="text-xs font-medium text-slate-500">
                {t('Cargando vista previa...')}
              </p>
            </div>
          )}

          {/* Render by document type */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 border"
                style={{ backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor }}
              >
                {renderIcon(32)}
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                {displayName}
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                {t('No se pudo generar la vista previa interactiva. Puedes descargar el archivo o abrirlo en tu visor local.')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void downloadRemoteFile(url, displayName)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>{t('Descargar archivo')}</span>
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-all"
                >
                  <ExternalLink size={15} />
                  <span>{t('Abrir en navegador')}</span>
                </a>
              </div>
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={url}
                alt={displayName}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setHasError(true);
                }}
              />
            </div>
          ) : isPdf || (isOffice && isRemote) ? (
            <iframe
              src={previewSource}
              title={displayName}
              className="w-full h-full border-0 bg-white"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 border"
                style={{ backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor }}
              >
                {renderIcon(32)}
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                {displayName}
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                {formattedSize ? `${docInfo.typeName} • ${formattedSize}` : docInfo.typeName}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void downloadRemoteFile(url, displayName)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>{t('Descargar archivo')}</span>
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-all"
                >
                  <ExternalLink size={15} />
                  <span>{t('Abrir en navegador')}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
