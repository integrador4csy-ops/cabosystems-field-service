import { useTranslation } from '../../context/LanguageContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useMemo, useRef, useState } from 'react';
import { GripVertical, Loader2, Search } from 'lucide-react';
import type { Tarea } from '../../types/projects';
import { TaskCard } from './TaskCard';
import './TaskBoard.css';

const columns = [
  { status: 'pendiente', label: 'Pendientes' },
  { status: 'en_proceso', label: 'En proceso' },
  { status: 'completada', label: 'Completadas' },
] as const;

interface TaskBoardProps {
  tasks: Tarea[];
  expandedTaskIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onTaskUpdated: () => void;
  onEditTask: (task: Tarea) => void;
  onMoveTask: (task: Tarea, status: Tarea['estatus']) => Promise<void>;
  showSearch?: boolean;
  projectLabels?: Record<string, string>;
}

export function TaskBoard({ tasks, expandedTaskIds, onToggleExpand, onTaskUpdated, onEditTask, onMoveTask, showSearch = true, projectLabels }: TaskBoardProps) {
  const { t } = useTranslation();
  const { user, isAdmin } = useAdminAuth();
  const [query, setQuery] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<Tarea['estatus'] | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const grouped = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    const matching = tasks.filter((task) => !term || `${task.titulo} ${task.descripcion || ''} ${task.profiles?.nombre || ''}`.toLocaleLowerCase('es').includes(term));
    return columns.map((column) => ({ ...column, tasks: matching.filter((task) => task.estatus === column.status) }));
  }, [tasks, query]);

  const moveTask = async (id: string, status: Tarea['estatus']) => {
    setDraggedId(null);
    setOverStatus(null);
    const task = tasks.find((item) => item.id === id);
    if (!task || task.estatus === status || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await onMoveTask(task, status);
      setNotice(t("«{value0}» movida a {value1}.", { value0: task.titulo, value1: t(columns.find((column) => column.status === status)?.label || status) }));
    } catch {
      setError(t("No se pudo mover la tarea. Intenta de nuevo."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="task-board-view">
      {showSearch && <div className="task-board-tools">
        <label className="task-board-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label={t("Buscar tareas en el tablero")} placeholder={t("Buscar tarea o responsable...")} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <span className="task-board-hint">{saving ? <><Loader2 size={14} className="animate-spin" /> {' '}{t("Guardando...")}</> : t("Arrastra una tarea o cambia su estado desde la tarjeta")}</span>
      </div>}
      <span role="status" className="sr-only">{notice}</span>
      {error && <p role="alert" className="task-board-error">{error}</p>}
      <div className="task-board" role="region" aria-label={t("Tablero de tareas por estado")} tabIndex={0}>
        {grouped.map((column) => (
          <section
            key={column.status}
            aria-label={`${t(column.label)}: ${column.tasks.length} ${t(column.tasks.length === 1 ? 'tarea' : 'tareas')}`}
            className={`task-board-column ${overStatus === column.status ? 'is-drop-target' : ''}`}
            onDragOver={(event) => { if (draggedId && !saving) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOverStatus(column.status); } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverStatus(null); }}
            onDrop={(event) => { event.preventDefault(); if (draggedId) void moveTask(draggedId, column.status); }}
          >
            <header className="task-board-column-heading"><h4>{t(column.label)}</h4><span>{column.tasks.length}</span></header>
            <div className="task-board-column-content">
              {column.tasks.length === 0 && <p className="task-board-empty">{query.trim() ? t("Sin coincidencias") : t("No hay tareas en este estado")}</p>}
              {column.tasks.map((task) => (
                <div key={task.id} className={`task-board-item ${draggedId === task.id ? 'is-dragging' : ''}`}>
                  <div className="task-board-drag-row">
                    <span
                      draggable={!saving && (isAdmin || task.asignado_a === user?.id)}
                      onDragStart={(event) => { setDraggedId(task.id); event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggedId(null); setOverStatus(null); }}
                      title={t("Arrastrar tarea a otro estado")}
                      aria-label={t("Arrastrar tarea a otro estado")}
                      className="task-board-drag-handle"
                    ><GripVertical size={16} aria-hidden="true" /></span>
                  </div>
                  <TaskCard task={task} variant="board" projectLabel={projectLabels?.[task.proyecto_id]} isExpanded={expandedTaskIds.has(task.id)} onToggleExpand={() => onToggleExpand(task.id)} onTaskUpdated={onTaskUpdated} onEditTask={onEditTask} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
