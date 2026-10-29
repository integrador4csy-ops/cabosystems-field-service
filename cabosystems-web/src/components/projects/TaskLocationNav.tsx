import { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, House } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import type { Proyecto } from '../../types/projects';

interface Props {
  projects: Proyecto[];
  development: string;
  projectId: string;
  revealProjectId?: string;
  loading: boolean;
  onSelect: (development: string, projectId: string) => void;
}

export function TaskLocationNav({ projects, development, projectId, revealProjectId, loading, onSelect }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Map<string, boolean>());
  const groups = useMemo(() => {
    const grouped = new Map<string, Proyecto[]>();
    for (const project of projects) {
      const villas = grouped.get(project.desarrollo) ?? [];
      villas.push(project); grouped.set(project.desarrollo, villas);
    }
    return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([name, villas]) => ({ name, villas: villas.sort((a, b) => a.villa.localeCompare(b.villa, undefined, { numeric: true })) }));
  }, [projects]);
  const select = (name: string, villa: string) => { onSelect(name, villa); setOpen(false); };
  const toggle = (key: string, expanded: boolean) => setExpandedGroups(previous => {
    const next = new Map(previous);
    next.set(key, !expanded);
    return next;
  });

  return <aside className={`task-location-panel ${open ? 'is-open' : ''}`} aria-label={t('Desarrollos y villas')}>
    <div className="task-location-heading">
      <h2>{t('Desarrollos y villas')}</h2>
      <p className="task-location-summary">{t(projects.length === 1 ? '{value0} villa' : '{value0} villas', { value0: projects.length })}</p>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><span>{t('Desarrollos y villas')}<span className="task-location-summary">{t(projects.length === 1 ? '{value0} villa' : '{value0} villas', { value0: projects.length })}</span></span><ChevronDown size={16} aria-hidden="true" /></button>
    </div>
    <div id={id} className="task-location-body">
    <nav className="task-location-list" aria-label={t('Seleccionar desarrollo o villa')}>
      {loading && !projects.length ? <p role="status">{t('Cargando villas...')}</p> : !groups.length ? <p>{t('No hay villas disponibles.')}</p> : groups.map(({ name, villas }, index) => {
        const expansionKey = `${revealProjectId ?? 'all'}:${name}`;
        const expanded = expandedGroups.get(expansionKey) ?? villas.some(villa => villa.id === revealProjectId);
        return <div className="task-location-group" key={name}>
          <div className="task-location-development">
            <button type="button" className="task-location-disclosure" aria-label={t('Mostrar villas de {value0}', { value0: name })} aria-expanded={expanded} aria-controls={`${id}-${index}`} onClick={() => toggle(expansionKey, expanded)}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            <button type="button" className={`task-location-name ${development === name ? 'has-selected-villa' : ''}`} aria-expanded={expanded} aria-controls={`${id}-${index}`} onClick={() => toggle(expansionKey, expanded)}><span>{name}</span><span className="task-location-total" aria-label={t(villas.length === 1 ? '{value0} villa' : '{value0} villas', { value0: villas.length })}>{villas.length}</span></button>
          </div>
          <ul id={`${id}-${index}`} hidden={!expanded}>{villas.map(villa => <li key={villa.id}><button type="button" aria-current={projectId === villa.id ? 'true' : undefined} onClick={() => select(name, villa.id)}><House size={15} aria-hidden="true" /><span>{villa.villa}</span></button></li>)}</ul>
        </div>;
      })}
    </nav>
    </div>
  </aside>;
}
