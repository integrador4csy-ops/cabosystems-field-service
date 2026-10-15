import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { useDialog } from '../ui/useDialog';
import { useTranslation } from '../../context/LanguageContext';
import type { Proyecto } from '../../types/projects';

interface ProjectCatalogProps {
  open: boolean;
  projects: Proyecto[];
  onClose: () => void;
  onSelect: (project: Proyecto) => void;
  onCreate: () => void;
  onEdit: (project: Proyecto) => void;
  onDelete: (project: Proyecto) => void;
  deletingId: string | null;
  error?: string | null;
}

export function ProjectCatalog({ open, projects, onClose, onSelect, onCreate, onEdit, onDelete, deletingId, error }: ProjectCatalogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const dialogRef = useDialog(open, onClose);
  const matching = useMemo(() => projects.filter((project) => `${project.desarrollo} ${project.villa}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [projects, query]);
  if (!open) return null;
  return createPortal(<div className="catalog-backdrop" onClick={onClose}>
    <aside ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Villas')} tabIndex={-1} className="project-catalog" onClick={(event) => event.stopPropagation()}>
      <header><div><h2>{t('Villas')}</h2><p>{t('Catálogo de desarrollos y villas')}</p></div><button type="button" className="workspace-icon" aria-label={t('Cerrar')} onClick={onClose}><X size={18} /></button></header>
      {error && <p role="alert" className="workspace-error">{t(error)}</p>}
      <div className="catalog-tools"><label className="workspace-search"><Search size={16} aria-hidden="true" /><input type="search" placeholder={t('Buscar villa...')} aria-label={t('Buscar villa...')} value={query} onChange={(event) => setQuery(event.target.value)} /></label><button type="button" className="workspace-primary" onClick={onCreate}><Plus size={15} />{t('Nueva Villa')}</button></div>
      <div className="catalog-list">
        {matching.map((project) => <div key={project.id} className="catalog-row">
          <button type="button" className="catalog-project" onClick={() => { onSelect(project); onClose(); }}><strong>{project.villa}</strong><span>{project.desarrollo} · {t(project.estatus)}</span>{project.descripcion && <p>{project.descripcion}</p>}</button>
          <div><button type="button" className="workspace-icon" aria-label={`${t('Editar Villa')}: ${project.villa}`} onClick={() => onEdit(project)}><Edit2 size={14} /></button><button type="button" className="workspace-icon catalog-delete" aria-label={`${t('Eliminar Villa')}: ${project.villa}`} disabled={deletingId === project.id} onClick={() => onDelete(project)}><Trash2 size={14} /></button></div>
        </div>)}
        {!matching.length && <p className="workspace-empty">{t('No se encontraron villas o desarrollos')}</p>}
      </div>
    </aside>
  </div>, document.body);
}
