import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import { applyVillaTaskTemplate, getVillaTaskTemplate, saveTaskTemplate } from '../../lib/taskTemplatesApi';
import { templateSelectionCounts, validTaskTemplate, type ApplyTemplateResult, type TaskTemplate, type TaskTemplateApplication, type TaskTemplateStage } from '../../lib/taskTemplates';
import type { Proyecto } from '../../types/projects';
import './TaskTemplateDialog.css';

export function TaskTemplateDialog({ project, onClose, onApplied }: { project: Proyecto; onClose: () => void; onApplied: (result: ApplyTemplateResult) => void }) {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<TaskTemplate | null>(null);
  const [application, setApplication] = useState<TaskTemplateApplication | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState<TaskTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const close = () => { if (!inFlight.current) onClose(); };
  const dialog = useDialog(true, close);
  useEffect(() => {
    const controller = new AbortController();
    getVillaTaskTemplate(project.id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTemplate(result.template); setApplication(result.application); setSelected((result.application?.contenido ?? result.template.etapas).map(stage => stage.number)); setError('');
    }).catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar la plantilla. Intenta de nuevo.'); });
    return () => controller.abort();
  }, [project.id, reload]);
  const previewStages = application?.contenido ?? template?.etapas ?? [];
  const counts = templateSelectionCounts(previewStages, selected);
  const countsText = `${counts.tasks} ${t(counts.tasks === 1 ? 'tarea' : 'tareas')} · ${counts.subtasks} ${t(counts.subtasks === 1 ? 'subtarea' : 'subtareas')}`;
  const cleanedDraft = draft && { ...draft, etapas: draft.etapas.map(stage => ({ ...stage, title: stage.title.trim(), subtasks: stage.subtasks.map(title => title.trim()).filter(Boolean) })) };
  const changeStage = (number: number, patch: Partial<TaskTemplateStage>) => setDraft(current => current && ({ ...current, etapas: current.etapas.map(stage => stage.number === number ? { ...stage, ...patch } : stage) }));
  const save = async () => {
    if (!cleanedDraft || !validTaskTemplate(cleanedDraft) || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const saved = await saveTaskTemplate(cleanedDraft);
      setTemplate(saved); setSelected((application?.contenido ?? saved.etapas).map(stage => stage.number)); setDraft(null); setNotice('Plantilla guardada. Las villas existentes conservan sus tareas.');
    } catch (cause) {
      setError((cause as { code?: string }).code === 'PGRST116' ? 'Otra persona modificó la plantilla. Cierra y vuelve a abrir para cargar la versión actual.' : 'No se pudo guardar la plantilla. Intenta de nuevo.');
    } finally { inFlight.current = false; setBusy(false); }
  };
  const apply = async () => {
    if (!template || application || !counts.tasks || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { onApplied(await applyVillaTaskTemplate(project.id, template, selected)); }
    catch (cause) { setError((cause as { code?: string }).code === '40001' ? 'La plantilla cambió. Cierra y vuelve a abrir para revisar la versión actual.' : 'No se pudo aplicar la plantilla. Intenta de nuevo.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="task-template-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={t(draft ? 'Editar plantilla general' : 'Aplicar plantilla')} tabIndex={-1} className="task-template-dialog">
      <header><div><h2>{t(draft ? 'Editar plantilla general' : 'Aplicar plantilla')}</h2><p>{project.desarrollo} · {project.villa}</p></div><button type="button" className="workspace-icon" disabled={busy} aria-label={t('Cerrar ventana')} onClick={close}><X size={18} /></button></header>
      <div className="task-template-content">
        {error && <div role="alert" className="task-template-error">{t(error)}{!template && <button className="workspace-button" type="button" onClick={() => setReload(value => value + 1)}>{t('Reintentar')}</button>}</div>}
        {notice && <p role="status" className="task-template-note">{t(notice)}</p>}
        {!template && !error ? <p role="status" className="task-template-note"><Loader2 size={18} className="animate-spin" />{t('Cargando plantilla...')}</p> : template && (draft ? <>
          <p className="task-template-note">{t('Los cambios solo se usarán en nuevas aplicaciones. No modifican tareas existentes.')}</p>
          <label className="task-template-field">{t('Nombre de la plantilla')}<input value={draft.nombre} maxLength={200} disabled={busy} onChange={event => setDraft({ ...draft, nombre: event.target.value })}/></label>
          {draft.etapas.map(stage => <article className="task-template-stage" key={stage.number}>
            <div className="task-template-edit-heading"><strong>{stage.number}.</strong><button type="button" disabled={busy || draft.etapas.length === 1} onClick={() => setDraft({ ...draft, etapas: draft.etapas.filter(item => item.number !== stage.number) })}>{t('Quitar etapa')}</button></div>
            <label className="task-template-field">{t('Título de la etapa')}<input value={stage.title} maxLength={400} disabled={busy} onChange={event => changeStage(stage.number, { title: event.target.value })}/></label>
            <label className="task-template-field">{t('Subtareas, una por línea')}<textarea rows={Math.min(8, Math.max(2, stage.subtasks.length + 1))} value={stage.subtasks.join('\n')} disabled={busy} onChange={event => changeStage(stage.number, { subtasks: event.target.value.split('\n') })}/></label>
          </article>)}
          <button type="button" className="workspace-button" disabled={busy || draft.etapas.length >= 100} onClick={() => setDraft({ ...draft, etapas: [...draft.etapas, { number: Math.max(...draft.etapas.map(stage => stage.number)) + 1, title: '', subtasks: [] }] })}><Plus size={15}/>{t('Añadir etapa')}</button>
        </> : <>
          <div className="task-template-definition"><div><h3>{template.nombre}</h3><p>{t('Versión {value0}', { value0: application?.version ?? template.version })}</p></div><button type="button" className="workspace-button" disabled={busy} onClick={() => { setDraft(structuredClone(template)); setError(''); setNotice(''); }}>{t('Editar plantilla general')}</button></div>
          {application ? <p role="status" className="task-template-note">{t('Esta plantilla ya se aplicó a esta villa. Se evita crear tareas duplicadas.')}</p> : <p className="task-template-note">{t('Elige las etapas de esta villa. Se crearán pendientes, sin responsable ni fecha. La plantilla se aplica una sola vez por villa.')}</p>}
          <div className="task-template-selection"><span aria-live="polite">{countsText}</span>{!application && <button type="button" disabled={busy} onClick={() => setSelected(selected.length === template.etapas.length ? [] : template.etapas.map(stage => stage.number))}>{t(selected.length === template.etapas.length ? 'Desmarcar todas' : 'Seleccionar todas')}</button>}</div>
          {previewStages.map(stage => <article className="task-template-stage" key={stage.number}>
            <label className="task-template-stage-check"><input type="checkbox" checked={selected.includes(stage.number)} disabled={busy || Boolean(application)} onChange={event => setSelected(current => event.target.checked ? [...current, stage.number] : current.filter(number => number !== stage.number))}/><strong>{stage.number}. {stage.title}</strong><span>{stage.subtasks.length}</span></label>
            {stage.subtasks.length > 0 && <details><summary>{t('Ver subtareas')}</summary><ol>{stage.subtasks.map((title, index) => <li key={index}><span>{stage.number}.{index + 1}</span>{title}</li>)}</ol></details>}
          </article>)}
        </>)}
      </div>
      <footer><button type="button" className="workspace-button" disabled={busy} onClick={() => { if (draft) { setDraft(null); setError(''); } else close(); }}>{t(draft ? 'Cancelar edición' : 'Cerrar')}</button>{template && (draft ? <button type="button" className="workspace-primary" disabled={busy || !cleanedDraft || !validTaskTemplate(cleanedDraft)} onClick={() => void save()}>{busy ? <Loader2 size={15} className="animate-spin"/> : null}{t('Guardar plantilla')}</button> : !application && <button type="button" className="workspace-primary" disabled={busy || !counts.tasks} onClick={() => void apply()}>{busy ? <Loader2 size={15} className="animate-spin"/> : null}{t(counts.tasks === 1 ? 'Crear 1 tarea' : 'Crear {value0} tareas', { value0: counts.tasks })}</button>)}</footer>
    </section>
  </div>;
}
