import { layoutViewport } from '../../lib/layoutViewport';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarDays, UserRound, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { getTaskStatusLabel } from '../../lib/uiTranslations';
import { parseDateKey } from '../../lib/taskDates';
import type { Tarea } from '../../types/projects';

export function CalendarTaskPreview({ task, projectLabel, onViewDetails }: { task: Tarea; projectLabel?: string; onViewDetails: () => void }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const cancelClose = () => { clearTimeout(closeTimer.current); };
  const show = () => { cancelClose(); setOpen(true); };
  const close = () => { cancelClose(); setOpen(false); };
  const leave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement) && document.activeElement !== triggerRef.current) setOpen(false);
    }, 220);
  };
  const closeWithFocus = () => { triggerRef.current?.focus(); close(); };

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const layout = layoutViewport(); const anchor = triggerRef.current ? layout.rect(triggerRef.current) : undefined;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const width = Math.min(340, layout.width - 24);
      panel.style.width = `${width}px`;
      const height = layout.rect(panel).height;
      const beside = layout.width - anchor.right >= width + 20;
      const left = beside ? anchor.right + 8 : anchor.left >= width + 20 ? anchor.left - width - 8 : anchor.left;
      const top = beside || anchor.left >= width + 20 ? anchor.top : anchor.bottom + 8 + height <= layout.height - 12 ? anchor.bottom + 8 : anchor.top - height - 8;
      panel.style.left = `${Math.max(12, Math.min(left, layout.width - width - 12))}px`;
      panel.style.top = `${Math.max(12, Math.min(top, layout.height - height - 12))}px`;
      panel.style.visibility = 'visible';
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); triggerRef.current?.focus(); setOpen(false); }
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      const layout = layoutViewport(); const anchor = triggerRef.current ? layout.rect(triggerRef.current) : undefined;
      const scrollViewport = triggerRef.current?.closest('.agenda-month-scroll'); const viewport = scrollViewport ? layout.rect(scrollViewport) : undefined;
      if (anchor && viewport && (anchor.bottom <= viewport.top || anchor.top >= viewport.bottom || anchor.right <= viewport.left || anchor.left >= viewport.right)) setOpen(false);
      else position();
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className={`agenda-calendar-task status-${task.estatus}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') show(); }} onPointerLeave={leave} onFocus={show} onBlur={leave} onClick={show}
      onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); show(); requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true })); } }}>
      <span className="agenda-calendar-status" aria-label={getTaskStatusLabel(task.estatus, t)} />
      <span className="agenda-calendar-task-copy"><strong>{task.titulo}</strong><span>{projectLabel}</span></span>
    </button>
    {open && createPortal(<div ref={panelRef} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1} className="agenda-task-preview"
      onPointerEnter={cancelClose} onPointerLeave={leave} onFocus={cancelClose} onBlur={leave}>
      <header><h3 id={`${id}-title`}>{task.titulo}</h3><button type="button" className="workspace-icon" aria-label={t('Cerrar')} onClick={closeWithFocus}><X size={16} aria-hidden="true" /></button></header>
      {projectLabel && <p className="agenda-task-preview-project">{projectLabel}</p>}
      <dl>
        <div><dt>{t('Estado')}</dt><dd>{getTaskStatusLabel(task.estatus, t)}</dd></div>
        <div><dt><CalendarDays size={14} aria-hidden="true" />{t('Fecha programada')}</dt><dd>{task.fecha_programada ? parseDateKey(task.fecha_programada).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : t('Sin fecha')}</dd></div>
        <div><dt><UserRound size={14} aria-hidden="true" />{t('Responsable')}</dt><dd>{task.profiles?.nombre || t('Sin asignar')}</dd></div>
      </dl>
      {task.descripcion && <p className="agenda-task-preview-description">{task.descripcion}</p>}
      {!!task.subtareas?.length && <ul className="agenda-task-preview-subtasks">{task.subtareas.map((subtask) => <li key={subtask.id}><input type="checkbox" checked={subtask.completada} readOnly tabIndex={-1} aria-label={subtask.titulo} /><span>{subtask.titulo}</span></li>)}</ul>}
      <footer><button type="button" className="workspace-primary" onClick={() => { close(); onViewDetails(); }}>{t('Ver detalles')}<ArrowRight size={16} aria-hidden="true" /></button></footer>
    </div>, document.body)}
  </>;
}
