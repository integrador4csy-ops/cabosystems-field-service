import { useMemo } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useSessionPreference } from '../../hooks/useSessionPreference';
import { useTranslation } from '../../context/LanguageContext';
import { dateKey, parseDateKey, shiftDate, shiftMonth, weekDates } from '../../lib/taskDates';
import type { Tarea } from '../../types/projects';
import { TaskCard } from './TaskCard';
import { TaskCalendar } from './TaskCalendar';
import { AppSelect } from '../ui/AppSelect';

export type AgendaView = 'month' | 'day' | 'week' | 'unscheduled';
type ScheduledAgendaView = Exclude<AgendaView, 'unscheduled'>;

interface TaskAgendaProps {
  tasks: Tarea[];
  projectLabels: Record<string, string>;
  expandedTaskIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onTaskUpdated: () => void;
  onEditTask: (task: Tarea) => void;
  onCreateTask: (day: string) => void;
  selectedDate: string;
  view: AgendaView;
  onDateChange: (date: string) => void;
  onViewChange: (view: AgendaView) => void;
}

export function TaskAgenda({ tasks, projectLabels, expandedTaskIds, onToggleExpand, onTaskUpdated, onEditTask, onCreateTask, selectedDate: anchor, view, onDateChange, onViewChange }: TaskAgendaProps) {
  const { t, locale } = useTranslation();
  const [lastScheduledView, setLastScheduledView] = useSessionPreference<ScheduledAgendaView>('csy_agenda_scheduled_view', 'month', (value): value is ScheduledAgendaView => typeof value === 'string' && ['month', 'week', 'day'].includes(value));
  const toggleUnscheduled = () => {
    if (view === 'unscheduled') onViewChange(lastScheduledView);
    else { setLastScheduledView(view); onViewChange('unscheduled'); }
  };
  const today = dateKey(new Date());
  const changeDate = onDateChange;
  const movePeriod = (direction: number) => changeDate(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)));
  const dates = useMemo(() => view === 'week' ? weekDates(anchor).slice(0, 5) : [anchor], [anchor, view]);
  const unscheduled = tasks.filter((task) => !task.fecha_programada);
  const renderCard = (task: Tarea) => <TaskCard key={task.id} task={task} variant="board" projectLabel={projectLabels[task.proyecto_id]} showScheduledDate={false} isExpanded={expandedTaskIds.has(task.id)} onToggleExpand={() => onToggleExpand(task.id)} onTaskUpdated={onTaskUpdated} onEditTask={onEditTask} />;

  return <div className="task-agenda">
    <div className="agenda-toolbar">
      <div className="agenda-period-heading">
        <button type="button" className="workspace-button agenda-today" onClick={() => { changeDate(dateKey(new Date())); if (view === 'unscheduled') onViewChange('day'); }}>{t('Hoy')}</button>
        {view !== 'unscheduled' && <>
          <div className="agenda-period-arrows">
            <button type="button" className="workspace-icon agenda-period-arrow" aria-label={t('Periodo anterior')} onClick={() => movePeriod(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" className="workspace-icon agenda-period-arrow" aria-label={t('Periodo siguiente')} onClick={() => movePeriod(1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
          <h2 className="agenda-month-title" aria-live="polite">{parseDateKey(anchor).toLocaleDateString(locale, { month: 'long' })} {parseDateKey(anchor).getFullYear()}</h2>
        </>}
      </div>
      <div className="agenda-date-controls">
        <button type="button" className="workspace-button agenda-unscheduled-toggle" aria-pressed={view === 'unscheduled'} onClick={toggleUnscheduled}>{view === 'unscheduled' && <Check size={16} aria-hidden="true" />}{t('Sin fecha')}<span className="agenda-count">{unscheduled.length}</span></button>
        {view !== 'unscheduled' && <div className="agenda-view-select">
          <AppSelect aria-label={t('Vista de agenda')} value={view} onChange={(event) => onViewChange(event.target.value as AgendaView)}>
            <option value="day">{t('Día')}</option>
            <option value="week">{t('Semana')}</option>
            <option value="month">{t('Mes')}</option>
          </AppSelect>
        </div>}
        {view !== 'unscheduled' && <input type="date" aria-label={t('Ir a fecha')} value={anchor} onChange={(event) => { if (event.target.value) changeDate(event.target.value); }} />}
      </div>
    </div>
    {view === 'month' ? <TaskCalendar tasks={tasks} selectedDate={anchor} projectLabels={projectLabels} onCreateTask={onCreateTask} onOpenDay={(day) => { changeDate(day); onViewChange('day'); }} /> : view === 'unscheduled' ? <div className="agenda-unscheduled">
      <p className="workspace-description">{t('Asigna una fecha desde la tarea para verla en la agenda.')}</p>
      {unscheduled.length ? <div className="agenda-day-cards">{unscheduled.map(renderCard)}</div> : <p className="workspace-empty">{t(tasks.length ? 'Todas las tareas tienen fecha.' : 'No hay tareas que coincidan con los filtros.')}</p>}
    </div> : <div className={`agenda-columns ${view === 'day' ? 'is-day' : ''}`} role="region" aria-label={t('Tareas por fecha')} tabIndex={0}>
      {dates.map((day) => {
        const dayTasks = tasks.filter((task) => task.fecha_programada === day);
        return <section key={day} className={`agenda-column ${day === today ? 'is-today' : ''}`}>
          <header className="agenda-column-header">
            <div><h3>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'long' })}</h3><span>{parseDateKey(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: view === 'day' ? 'numeric' : undefined })}</span></div>
            <div className="agenda-day-actions"><span className="agenda-count">{dayTasks.length}</span><button type="button" className="agenda-create-task" aria-label={t('Crear tarea para el {date}', { date: parseDateKey(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })} onClick={() => onCreateTask(day)}><Plus size={16} aria-hidden="true" /></button></div>
          </header>
          <div className={view === 'day' ? 'agenda-day-cards' : 'agenda-week-cards'}>
            {dayTasks.length ? dayTasks.map(renderCard) : <div className="workspace-empty"><CalendarDays size={22} aria-hidden="true" /><p>{t('No hay tareas programadas para este día.')}</p></div>}
          </div>
        </section>;
      })}
    </div>}
  </div>;
}
