import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import { AppSelect } from '../ui/AppSelect';
import { getTaskReport, getTaskReportPeople } from '../../lib/taskReportsApi';
import { reportAction, reportRange, reportStatus, reportSummary, reportToday, validReportDate, type ReportPeriod, type TaskReport } from '../../lib/taskReports';
import type { Profile } from '../../types/fleet';
import type { Proyecto } from '../../types/projects';
import './TaskReportDialog.css';

export function TaskReportDialog({ projects, staff, initialProject, onClose }: { projects: Proyecto[]; staff: Profile[]; initialProject?: string; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const en = locale.startsWith('en');
  const dialog = useDialog<HTMLElement>(true, onClose);
  const [period, setPeriod] = useState<ReportPeriod>('day');
  const [anchor, setAnchor] = useState(reportToday);
  const [custom, setCustom] = useState({ from: reportToday(), to: reportToday() });
  const [person, setPerson] = useState('');
  const [project, setProject] = useState(initialProject || '');
  const [historical, setHistorical] = useState<{ id: string; nombre: string }[]>([]);
  const [peopleError, setPeopleError] = useState(false);
  const [retryPeople, setRetryPeople] = useState(0);
  const [result, setResult] = useState<{ signature: string; report: TaskReport } | null>(null);
  const [busy, setBusy] = useState<'load' | 'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const people = useMemo(() => {
    const values = new Map(staff.map(member => [member.id, { id: member.id, nombre: member.nombre || member.full_name || member.email || member.id }]));
    for (const member of historical) if (!values.has(member.id)) values.set(member.id, member);
    return [...values.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, locale));
  }, [staff, historical, locale]);
  const range = period === 'custom' ? custom : validReportDate(anchor) ? reportRange(period, anchor) : { from: '', to: '' };
  const valid = validReportDate(range.from) && validReportDate(range.to) && range.from <= range.to;
  const signature = JSON.stringify([range.from, range.to, person, project]);
  const report = result?.signature === signature ? result.report : null;
  const summary = report ? reportSummary(report.rows) : null;
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    const request = new AbortController();
    getTaskReportPeople(request.signal).then(values => { setHistorical(values); setPeopleError(false); }).catch(() => { if (!request.signal.aborted) setPeopleError(true); });
    return () => request.abort();
  }, [retryPeople]);
  const changeFilters = (update: () => void) => { controller.current?.abort(); setBusy(null); setError(''); update(); };
  const generate = async () => {
    if (!valid || busy) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy('load'); setError(''); setResult(null);
    try {
      const rows = await getTaskReport(range.from, range.to, person, project, request.signal);
      if (!request.signal.aborted) setResult({ signature, report: { ...range, rows, person: people.find(member => member.id === person)?.nombre || t('Todas las personas'), project: projects.find(villa => villa.id === project) ? `${projects.find(villa => villa.id === project)!.desarrollo} · ${projects.find(villa => villa.id === project)!.villa}` : t('Todas las villas accesibles') } });
    } catch { if (!request.signal.aborted) setError(t('No se pudo generar el informe. Intenta de nuevo.')); }
    finally { if (!request.signal.aborted) setBusy(null); }
  };
  const download = async (format: 'pdf' | 'xlsx') => {
    if (!report || busy) return;
    const request = new AbortController(); controller.current = request; setBusy(format); setError('');
    try {
      const exports = await import('../../lib/taskReportExport');
      const blob = await (format === 'pdf' ? exports.taskReportPdf(report, en) : exports.taskReportExcel(report, en));
      if (alive.current && !request.signal.aborted) exports.downloadTaskReport(blob, report, format);
    } catch { if (!request.signal.aborted) setError(t('No se pudo descargar el informe. Intenta de nuevo.')); }
    finally { if (alive.current && !request.signal.aborted) setBusy(null); }
  };
  return <div className="task-report-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="task-report-dialog" role="dialog" aria-modal="true" aria-labelledby="task-report-title" tabIndex={-1}>
      <header><div><h2 id="task-report-title">{t('Informe de tareas')}</h2><p>{t('Actividad por fecha y persona')}</p></div><button type="button" aria-label={t('Cerrar')} onClick={onClose}><X size={20} /></button></header>
      <div className="task-report-content">
        <form onSubmit={event => { event.preventDefault(); void generate(); }}>
          <div className="task-report-filters">
            <label>{t('Periodo')}<AppSelect aria-label={t('Periodo')} value={period} onChange={event => changeFilters(() => setPeriod(event.target.value as ReportPeriod))}>{(['day', 'week', 'month', 'custom'] as const).map((value, index) => <option key={value} value={value}>{t(['Diario', 'Semanal', 'Mensual', 'Personalizado'][index])}</option>)}</AppSelect></label>
            {period === 'custom' ? <><label>{t('Desde')}<input required type="date" min="1900-01-01" max="9999-12-31" value={custom.from} onChange={event => changeFilters(() => setCustom(current => ({ ...current, from: event.target.value })))} /></label><label>{t('Hasta')}<input required type="date" min={custom.from || '1900-01-01'} max="9999-12-31" value={custom.to} onChange={event => changeFilters(() => setCustom(current => ({ ...current, to: event.target.value })))} /></label></> : <label>{t('Fecha de referencia')}<input required type="date" min="1900-01-01" max="9999-12-31" value={anchor} onChange={event => changeFilters(() => setAnchor(event.target.value))} /></label>}
            <label>{t('Realizado por')}<AppSelect aria-label={t('Realizado por')} value={person} onChange={event => changeFilters(() => setPerson(event.target.value))}><option value="">{t('Todas las personas')}</option>{people.map(member => <option value={member.id} key={member.id}>{member.nombre}</option>)}</AppSelect></label>
            <label>{t('Villa')}<AppSelect aria-label={t('Villa')} value={project} onChange={event => changeFilters(() => setProject(event.target.value))}><option value="">{t('Todas las villas accesibles')}</option>{projects.map(villa => <option value={villa.id} key={villa.id}>{villa.desarrollo} · {villa.villa}</option>)}</AppSelect></label>
          </div>
          <div className="task-report-generate"><span>{valid ? `${range.from} — ${range.to}` : t('Selecciona un periodo válido.')}</span><button type="submit" className="workspace-primary" disabled={!valid || Boolean(busy)}>{busy === 'load' && <Loader2 size={15} className="animate-spin" />}{t('Generar informe')}</button></div>
        </form>
        <p className="task-report-note">{t('Fechas de Los Cabos, sin hora. La persona es quien realizó la acción, no el encargado asignado. El historial comienza al activar esta función.')}</p>
        {peopleError && <p role="alert" className="task-report-note">{t('No se pudieron consultar personas del historial.')} <button type="button" onClick={() => setRetryPeople(value => value + 1)}>{t('Reintentar')}</button></p>}
        {error && <p role="alert" className="task-report-error">{error}</p>}
        {report && summary && <>
          <dl className="task-report-summary"><div><dt>{t('Acciones')}</dt><dd>{summary.actions}</dd></div><div><dt>{t('Tareas con actividad')}</dt><dd>{summary.tasks}</dd></div><div><dt>{t('Subtareas marcadas')}</dt><dd>{summary.completed}</dd></div><div><dt>{t('Reaperturas de subtareas')}</dt><dd>{summary.reopened}</dd></div></dl>
          {report.rows.length ? <><div className="task-report-table" tabIndex={0} role="region" aria-label={t('Actividad registrada')}><table><thead><tr>{['Fecha', 'Realizado por', 'Villa', 'Tarea / subtarea', 'Acción', 'Estado actual'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{report.rows.slice(0, 100).map(row => <tr key={row.id}><td>{row.fecha}</td><td>{row.actor_name}</td><td>{row.desarrollo}<small>{row.villa}</small></td><td>{row.tarea_titulo}{row.subtarea_titulo && <small>{row.subtarea_titulo}</small>}</td><td>{reportAction(row, en)}</td><td>{reportStatus(row.estado_actual, en)}</td></tr>)}</tbody></table></div>{report.rows.length > 100 && <p className="task-report-note">{t('Vista previa: primeras 100 acciones. La descarga incluye todas.')}</p>}</> : <p className="task-report-empty" role="status">{t('No hay actividad registrada para este periodo y persona.')}</p>}
        </>}
      </div>
      <footer><button type="button" className="workspace-button" onClick={onClose}>{t('Cerrar')}</button><button type="button" className="workspace-button" disabled={!report?.rows.length || Boolean(busy)} onClick={() => void download('xlsx')}>{busy === 'xlsx' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{t('Descargar Excel')}</button><button type="button" className="workspace-primary" disabled={!report?.rows.length || Boolean(busy)} onClick={() => void download('pdf')}>{busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{t('Descargar PDF')}</button></footer>
    </section>
  </div>;
}
