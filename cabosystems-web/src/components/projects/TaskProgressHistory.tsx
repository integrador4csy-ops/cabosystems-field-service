import { useEffect, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { getTaskProgressHistory, type TaskProgressActivity } from '../../lib/projectsApi';

function actionLabel(activity: TaskProgressActivity, t: (key: string, values?: Record<string, string | number>) => string) {
  if (activity.accion === 'subtarea') return activity.siguiente === 'true' ? t('Completó la subtarea {value0}', { value0: activity.subtarea_titulo || '' }) : t('Reabrió la subtarea {value0}', { value0: activity.subtarea_titulo || '' });
  return t('Cambió el estado a {value0}', { value0: t(activity.siguiente === 'en_proceso' ? 'En Proceso' : activity.siguiente === 'completada' ? 'Completada' : 'Pendiente') });
}

export function TaskProgressHistory({ taskId, version }: { taskId: string; version: string }) {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<TaskProgressActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void getTaskProgressHistory(taskId).then(data => { if (!controller.signal.aborted) setRows(data); }).catch(() => { if (!controller.signal.aborted) setError(t('No se pudo cargar el historial.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId, version, retry, t]);
  return <section className="task-progress-history" aria-label={t('Historial de avances')}>
    <h5>{t('Historial de avances')}</h5>
    {loading ? <p><Loader2 size={14} className="animate-spin" /> {t('Cargando...')}</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>{t('Reintentar')}</button></p> : rows.length === 0 ? <p>{t('Aún no hay avances registrados.')}</p> : <ol>{rows.map(row => <li key={row.id}><div><strong>{row.actor_name}</strong><time dateTime={row.captured_at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mazatlan' }).format(new Date(row.captured_at))}</time></div><p>{actionLabel(row, t)}</p>{row.comentario ? <blockquote>{row.comentario}</blockquote> : null}{row.evidence_url ? <a href={row.evidence_url} target="_blank" rel="noreferrer"><img src={row.evidence_url} alt={t('Evidencia de {value0}', { value0: row.actor_name })} loading="lazy" /><span><Camera size={14} /> {t('Abrir evidencia')}</span></a> : null}</li>)}</ol>}
  </section>;
}
