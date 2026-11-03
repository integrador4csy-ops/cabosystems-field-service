import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Play,
  Clock,
  RotateCcw,
  Camera,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import {
  getChatGroupTaskActivity,
  type ChatGroupTaskActivityItem,
} from '../../lib/chatApi';

interface GroupTaskActivitySectionProps {
  groupId: string;
  onImageClick?: (url: string, caption?: string | null) => void;
}

const PAGE_SIZE = 15;

export const GroupTaskActivitySection: React.FC<GroupTaskActivitySectionProps> = ({
  groupId,
  onImageClick,
}) => {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<ChatGroupTaskActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getChatGroupTaskActivity(groupId, PAGE_SIZE, 0);
      setItems(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      console.error('Error loading group task activity:', err);
      setError(t('Error al cargar las tareas realizadas.'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextData = await getChatGroupTaskActivity(groupId, PAGE_SIZE, offset);
      setItems((prev) => [...prev, ...nextData]);
      setOffset((prev) => prev + nextData.length);
      setHasMore(nextData.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more task activity:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const getActionBadge = (item: ChatGroupTaskActivityItem) => {
    if (item.accion === 'subtarea') {
      if (item.siguiente === 'true') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            <CheckCircle2 size={11} />
            {t('Subtarea completada')}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          <RotateCcw size={11} />
          {t('Subtarea reabierta')}
        </span>
      );
    }

    if (item.siguiente === 'completada') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          <CheckCircle2 size={11} />
          {t('Completada')}
        </span>
      );
    }
    if (item.siguiente === 'en_proceso') {
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

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-brand-500" />
          <h4 className="text-xs font-bold text-[#343e48] tracking-wider uppercase">
            {t('Tareas realizadas')}
          </h4>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          {items.length}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 size={18} className="animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-center">
          <AlertCircle size={16} className="mx-auto text-red-500 mb-1" />
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <button
            type="button"
            onClick={loadInitial}
            className="inline-flex items-center gap-1 rounded-lg bg-white border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <RefreshCw size={12} />
            {t('Reintentar')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          {t('No hay tareas ni avances registrados en esta villa.')}
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 transition-all hover:bg-slate-50 hover:border-slate-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h5 className="font-semibold text-slate-800 text-xs truncate">
                      {item.tarea_titulo}
                    </h5>
                    {getActionBadge(item)}
                  </div>
                  {item.subtarea_titulo ? (
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500 truncate">
                      {item.subtarea_titulo}
                    </p>
                  ) : null}
                </div>
                <time
                  className="shrink-0 text-[10px] text-slate-400"
                  dateTime={item.captured_at}
                >
                  {new Date(item.captured_at).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>

              {/* Author & date */}
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400">
                <span className="font-medium text-slate-600">{item.actor_name}</span>
                <span>·</span>
                <span>
                  {new Date(item.captured_at).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              {/* Optional Comment */}
              {item.comentario ? (
                <blockquote className="mt-1.5 rounded-md border-l-2 border-brand-400 bg-white/90 px-2 py-1 text-[11px] italic text-slate-600">
                  “{item.comentario}”
                </blockquote>
              ) : null}

              {/* Optional Evidence Photo */}
              {item.evidence_url ? (
                <button
                  type="button"
                  onClick={() => onImageClick?.(item.evidence_url!, item.tarea_titulo)}
                  className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 text-left transition-all hover:border-brand-400 hover:shadow-2xs"
                >
                  <img
                    src={item.evidence_url}
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
            </div>
          ))}

          {/* Load More Button */}
          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loadingMore ? (
                <Loader2 size={13} className="animate-spin text-brand-500" />
              ) : null}
              <span>{t('Cargar más tareas')}</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
