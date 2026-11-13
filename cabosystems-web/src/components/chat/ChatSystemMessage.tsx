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
  const { t, locale } = useTranslation();
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

  // Extract task and subtask titles from meta, with fallback to parsing content
  let taskTitle = meta?.task_title;
  let subtaskTitle = meta?.subtask_title;
  let actorName = message.profiles?.nombre || message.profiles?.full_name;

  if (!taskTitle && message.contenido) {
    const subtaskMatch = message.contenido.match(/«([^»]+)»\s+en\s+«([^»]+)»/);
    if (subtaskMatch) {
      subtaskTitle = subtaskMatch[1];
      taskTitle = subtaskMatch[2];
    } else {
      const taskMatch = message.contenido.match(/cambió\s+«([^»]+)»/);
      if (taskMatch) {
        taskTitle = taskMatch[1];
      }
    }
  }

  if (!actorName && message.contenido) {
    const parts = message.contenido.split(/\s+(?:completó|reabrió|cambió|inició)\s+/);
    if (parts.length > 1) {
      actorName = parts[0].trim();
    }
  }

  // Fallback for non-task generic system messages
  if (!taskTitle && !subtaskTitle && !meta?.task_id) {
    return (
      <div id={`chat-message-${message.id}`} className="my-2 flex w-full justify-center px-4">
        <div className="rounded-full bg-slate-100 border border-slate-200/70 px-3.5 py-1 text-center text-xs text-slate-500 shadow-2xs">
          {message.contenido}
        </div>
      </div>
    );
  }

  const getActionBadge = () => {
    const isSubtask = meta?.action === 'subtarea' || Boolean(subtaskTitle);
    if (isSubtask) {
      if (meta?.siguiente === 'false') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            <RotateCcw size={11} />
            {t('Subtarea reabierta')}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          <CheckCircle2 size={11} />
          {t('Subtarea completada')}
        </span>
      );
    }

    if (meta?.siguiente === 'completada' || meta?.estado === 'completada') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          <CheckCircle2 size={11} />
          {t('Completada')}
        </span>
      );
    }
    if (meta?.siguiente === 'en_proceso' || meta?.estado === 'en_proceso') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
          <Play size={10} className="fill-brand-600" />
          {t('En Proceso')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
        <Clock size={11} />
        {t('Pendiente')}
      </span>
    );
  };

  const villaLabel = meta?.villa ? `${meta.desarrollo ? `${meta.desarrollo} · ` : ''}${meta.villa}` : null;
  const dateFormatted = new Date(message.created_at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      id={`chat-message-${message.id}`}
      className="my-3 flex w-full justify-center px-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300">
        {/* Top row: Stage / Task title, Action Badge, Time */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="font-semibold text-slate-800 text-xs truncate">
                {taskTitle || t('Tarea')}
              </h5>
              {getActionBadge()}
            </div>
            {subtaskTitle ? (
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 truncate">
                {subtaskTitle}
              </p>
            ) : null}
          </div>
          <time className="shrink-0 text-[10px] text-slate-400" dateTime={message.created_at}>
            {timeFormatted}
          </time>
        </div>

        {/* Author, date and villa */}
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400">
          <span className="font-medium text-slate-600">{actorName || t('Colaborador')}</span>
          <span>·</span>
          <span>{dateFormatted}</span>
          {villaLabel ? (
            <>
              <span>·</span>
              <span className="rounded bg-white border border-slate-200/80 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 shadow-2xs">
                {villaLabel}
              </span>
            </>
          ) : null}
        </div>

        {/* Optional Comment */}
        {meta?.comentario ? (
          <blockquote className="mt-1.5 rounded-md border-l-2 border-brand-400 bg-white/90 px-2.5 py-1 text-[11px] italic text-slate-600">
            {meta.comentario.replace(/^[“"']+|[”"']+$/g, '').trim()}
          </blockquote>
        ) : null}

        {/* Optional Evidence Photo */}
        {evidenceUrl ? (
          <button
            type="button"
            onClick={() => onImageClick?.(evidenceUrl, taskTitle || message.contenido)}
            className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 text-left transition-all hover:border-brand-400 hover:shadow-2xs cursor-pointer"
          >
            <img
              src={evidenceUrl}
              alt={t('Evidencia')}
              className="h-10 w-10 rounded-md object-cover"
              loading="lazy"
            />
            <div className="min-w-0 flex-1 pr-1">
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-brand-600">
                <Camera size={11} />
                {t('Ver foto de evidencia')}
              </span>
            </div>
          </button>
        ) : null}

        {/* View task link button */}
        {meta?.task_id ? (
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setTaskSearchQuery('');
                setTargetTaskId(meta.task_id!);
                setActiveItem('proyectos');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[10.5px] font-medium text-brand-600 shadow-2xs hover:bg-orange-50 cursor-pointer"
            >
              <ExternalLink size={11} />
              {t('Ver tarea')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
