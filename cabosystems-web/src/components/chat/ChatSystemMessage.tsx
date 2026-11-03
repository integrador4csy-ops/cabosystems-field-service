import React, { useEffect, useState } from 'react';
import { CheckCircle2, Play, Clock, RotateCcw, Camera, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../context/LanguageContext';
import type { ChatMessage } from '../../types/chat';
import { useSidebar } from '../../context/SidebarContext';

interface ChatSystemMessageProps {
  message: ChatMessage;
  timeFormatted: string;
  onImageClick?: (url: string, caption?: string | null) => void;
}

export const ChatSystemMessage: React.FC<ChatSystemMessageProps> = ({
  message,
  timeFormatted,
  onImageClick,
}) => {
  const { t } = useTranslation();
  const { setTargetTaskId, setTaskSearchQuery, setActiveItem } = useSidebar();
  const meta = message.media_meta;
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  useEffect(() => {
    const evidencePath = meta?.evidencia_path || (message.media_url?.includes('/') ? message.media_url : null);
    if (!evidencePath) return;

    let isMounted = true;
    supabase.storage
      .from('task-evidence')
      .createSignedUrl(evidencePath, 3600)
      .then(({ data }) => {
        if (isMounted && data?.signedUrl) {
          setEvidenceUrl(data.signedUrl);
        }
      })
      .catch((err) => {
        console.error('Error fetching signed evidence url:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [meta?.evidencia_path, message.media_url]);

  // Determine icon & color based on action / status
  const isCompleted = meta?.siguiente === 'true' || meta?.siguiente === 'completada' || meta?.estado === 'completada';
  const isInProgress = meta?.siguiente === 'en_proceso' || meta?.estado === 'en_proceso';
  const isReopened = meta?.action === 'subtarea' && meta?.siguiente === 'false';

  const icon = isCompleted ? (
    <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
  ) : isInProgress ? (
    <Play size={14} className="text-brand-500 fill-brand-500 shrink-0 mt-0.5" />
  ) : isReopened ? (
    <RotateCcw size={14} className="text-amber-500 shrink-0 mt-0.5" />
  ) : (
    <Clock size={15} className="text-slate-400 shrink-0 mt-0.5" />
  );

  const villaLabel = meta?.villa ? `${meta.desarrollo ? `${meta.desarrollo} · ` : ''}${meta.villa}` : null;

  return (
    <div
      id={`chat-message-${message.id}`}
      className="my-3 flex w-full justify-center px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3 shadow-2xs backdrop-blur-xs transition-all hover:bg-slate-50">
        {/* Header row: Icon, Villa Badge, Timestamp */}
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/60">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon}
            {villaLabel ? (
              <span className="truncate rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs">
                {villaLabel}
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('Actividad')}
              </span>
            )}
          </div>
          <time className="shrink-0 text-[10.5px] text-slate-400" dateTime={message.created_at}>
            {timeFormatted}
          </time>
        </div>

        {/* Content summary */}
        <p className="mt-2 text-xs font-medium text-slate-800 leading-relaxed">
          {message.contenido}
        </p>

        {/* Optional Comment */}
        {meta?.comentario ? (
          <blockquote className="mt-2 rounded-lg border-l-2 border-brand-400 bg-white/80 px-2.5 py-1.5 text-[11.5px] italic text-slate-600 shadow-2xs">
            “{meta.comentario}”
          </blockquote>
        ) : null}

        {/* Optional Evidence Photo */}
        {evidenceUrl ? (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => onImageClick?.(evidenceUrl, message.contenido)}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-left transition-all hover:border-brand-400 hover:shadow-xs"
            >
              <img
                src={evidenceUrl}
                alt={t('Evidencia')}
                className="h-14 w-14 rounded-lg object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1 pr-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-brand-600 group-hover:text-brand-700">
                  <Camera size={13} />
                  {t('Ver foto de evidencia')}
                </span>
                <span className="block truncate text-[10px] text-slate-400">
                  {meta?.task_title || t('Evidencia')}
                </span>
              </div>
            </button>
          </div>
        ) : null}

        {/* Optional View Task link */}
        {meta?.task_id ? (
          <div className="mt-2 flex items-center">
            <button type="button" onClick={() => { setTaskSearchQuery(''); setTargetTaskId(meta.task_id!); setActiveItem('proyectos'); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[10.5px] font-medium text-brand-600 shadow-2xs hover:bg-orange-50">
              <ExternalLink size={11} />
              {t('Ver tarea')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
