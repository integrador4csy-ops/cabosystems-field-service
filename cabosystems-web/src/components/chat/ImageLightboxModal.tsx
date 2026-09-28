import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  caption?: string | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  caption,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[92vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#f78c26] transition-all shadow-md backdrop-blur-xs"
            title="Descargar imagen"
          >
            <Download size={18} />
          </a>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#f78c26] transition-all shadow-md backdrop-blur-xs"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink size={18} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-rose-600 transition-all shadow-md backdrop-blur-xs"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* The Image */}
        <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center max-h-[82vh]">
          <img
            src={imageUrl}
            alt={caption || 'Evidencia técnica'}
            className="max-h-[82vh] max-w-full object-contain rounded-2xl select-none"
          />
        </div>

        {/* Optional Caption */}
        {caption && (
          <div className="mt-3 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium max-w-xl text-center shadow-lg">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
