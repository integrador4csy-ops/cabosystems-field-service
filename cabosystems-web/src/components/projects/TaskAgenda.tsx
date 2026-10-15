import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { dateKey, parseDateKey, shiftDate, shiftMonth, weekDates } from '../../lib/taskDates';
import type { Tarea } from '../../types/projects';
import { TaskCard } from './TaskCard';
import { TaskCalendar } from './TaskCalendar';

export type AgendaView = 'month' | 'day' | 'week' | 'unscheduled';

interface TaskAgendaProps {
  tasks: Tarea[];
  projectLabels: Record<string, string>;
  expandedTaskIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onTaskUpdated: () => void;
  onEditTask: (task: Tarea) => void;
  selectedDate: string;
  view: AgendaView;
  onDateChange: (date: string) => void;
  onViewChange: (view: AgendaView) => void;
}

export function TaskAgenda({ tasks, projectLabels, expandedTaskIds, onToggleExpand, onTaskUpdated, onEditTask, selectedDate: anchor, view, onDateChange, onViewChange }: TaskAgendaProps) {
  const { t, locale } = useTranslation();
  const today = dateKey(new Date());
  const changeDate = onDateChange;
  const movePeriod = (direction: number) => changeDate(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)));
  const dates = useMemo(() => view === 'week' ? weekDates(anchor).slice(0, 5) : [anchor], [anchor, view]);
  const unscheduled = tasks.filter((task) => !task.fecha_programada);
  const renderCard = (task: Tarea) => <TaskCard key={task.id} task={task} variant="board" projectLabel={projectLabels[task.proyecto_id]} showScheduledDate={false} isExpanded={expandedTaskIds.has(task.id)} onToggleExpand={() => onToggleExpand(task.id)} onTaskUpdated={onTaskUpdated} onEditTask={onEditTask} />;

  return <div className="task-agenda">
    <div className="agenda-toolbar">
      <div className="workspace-view-switch" role="group" aria-label={t('Vista de agenda')}>
        {([{ id: 'month', label: 'Calendario' }, { id: 'day', label: 'Día' }, { id: 'week', label: 'Semana' }, { id: 'unscheduled', label: 'Sin fecha' }] as const).map((item) => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => onViewChange(item.id)}>{t(item.label)}{item.id === 'unscheduled' && <span>{unscheduled.length}</span>}</button>)}
      </div>
      {view !== 'unscheduled' && <div className="agenda-date-controls">
        <button type="button" className="workspace-icon" aria-label={t('Periodo anterior')} onClick={() => movePeriod(-1)}><ChevronLeft size={16} /></button>
        <button type="button" className="workspace-button" onClick={() => changeDate(today)}>{t('Hoy')}</button>
        <button type="button" className="workspace-icon" aria-label={t('Periodo siguiente')} onClick={() => movePeriod(1)}><ChevronRight size={16} /></button>
        <input type="date" aria-label={t('Ir a fecha')} value={anchor} onChange={(event) => { if (event.target.value) changeDate(event.target.value); }} />
      </div>}
    </div>
    {view === 'month' ? <><h2 className="agenda-month-title" aria-live="polite">{parseDateKey(anchor).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h2><TaskCalendar tasks={tasks} selectedDate={anchor} projectLabels={projectLabels} onEditTask={onEditTask} onOpenDay={(day) => { changeDate(day); onViewChange('day'); }} /></> : view === 'unscheduled' ? <div className="agenda-unscheduled">
      <p className="workspace-description">{t('Asigna una fecha desde la tarea para verla en la agenda.')}</p>
      {unscheduled.length ? <div className="agenda-day-cards">{unscheduled.map(renderCard)}</div> : <p className="workspace-empty">{t(tasks.length ? 'Todas las tareas tienen fecha.' : 'No hay tareas que coincidan con los filtros.')}</p>}
    </div> : <div className={`agenda-columns ${view === 'day' ? 'is-day' : ''}`} role="region" aria-label={t('Tareas por fecha')} tabIndex={0}>
      {dates.map((day) => {
        const dayTasks = tasks.filter((task) => task.fecha_programada === day);
        return <section key={day} className={`agenda-column ${day === today ? 'is-today' : ''}`}>
          <header className="agenda-column-header">
            <div><h3>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'long' })}</h3><span>{parseDateKey(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: view === 'day' ? 'numeric' : undefined })}</span></div>
            <span className="agenda-count">{dayTasks.length}</span>
          </header>
          <div className={view === 'day' ? 'agenda-day-cards' : 'agenda-week-cards'}>
            {dayTasks.length ? dayTasks.map(renderCard) : <div className="workspace-empty"><CalendarDays size={22} aria-hidden="true" /><p>{t('No hay tareas programadas para este día.')}</p></div>}
          </div>
        </section>;
      })}
    </div>}
  </div>;
}
