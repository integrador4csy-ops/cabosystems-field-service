import { useMemo } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { getTaskStatusLabel } from '../../lib/uiTranslations';
import { dateKey, monthWorkWeeks, parseDateKey } from '../../lib/taskDates';
import type { Tarea } from '../../types/projects';

interface TaskCalendarProps {
  tasks: Tarea[];
  selectedDate: string;
  projectLabels: Record<string, string>;
  onOpenDay: (day: string) => void;
  onEditTask: (task: Tarea) => void;
}

export function TaskCalendar({ tasks, selectedDate, projectLabels, onOpenDay, onEditTask }: TaskCalendarProps) {
  const { t, locale } = useTranslation();
  const weeks = useMemo(() => monthWorkWeeks(selectedDate), [selectedDate]);
  const byDate = useMemo(() => {
    const grouped = new Map<string, Tarea[]>();
    for (const task of tasks) {
      if (!task.fecha_programada) continue;
      const items = grouped.get(task.fecha_programada) || [];
      items.push(task);
      grouped.set(task.fecha_programada, items);
    }
    return grouped;
  }, [tasks]);
  const today = dateKey(new Date());
  const month = selectedDate.slice(0, 7);
  return <div className="agenda-month-scroll" role="region" aria-label={t('Calendario de tareas')} tabIndex={0}>
    <table className="agenda-month">
      <caption className="sr-only">{parseDateKey(selectedDate).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</caption>
      <thead><tr>{weeks[0].map((day) => <th key={day} scope="col">{parseDateKey(day).toLocaleDateString(locale, { weekday: 'long' })}</th>)}</tr></thead>
      <tbody>{weeks.map((week) => <tr key={week[0]}>{week.map((day) => {
        const items = byDate.get(day) || [];
        const dateLabel = parseDateKey(day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return <td key={day} className={`${day.slice(0, 7) !== month ? 'is-outside-month' : ''} ${day === today ? 'is-today' : ''} ${day === selectedDate ? 'is-selected' : ''}`}>
          <div className="agenda-month-day-heading"><button type="button" className="agenda-month-date" aria-label={t('Ver tareas del {date}', { date: dateLabel })} aria-current={day === today ? 'date' : undefined} onClick={() => onOpenDay(day)}>{parseDateKey(day).getDate()}</button>{items.length > 0 && <span className="agenda-count">{items.length}</span>}</div>
          <div className="agenda-month-tasks">{items.slice(0, 3).map((task) => <button key={task.id} type="button" className={`agenda-calendar-task status-${task.estatus}`} title={`${task.titulo}\n${projectLabels[task.proyecto_id] || ''}\n${getTaskStatusLabel(task.estatus, t)}`} onClick={() => onEditTask(task)}><span className="agenda-calendar-status" aria-label={getTaskStatusLabel(task.estatus, t)} /><span className="agenda-calendar-task-copy"><strong>{task.titulo}</strong><span>{projectLabels[task.proyecto_id]}</span></span></button>)}{items.length > 3 && <button type="button" className="agenda-month-more" onClick={() => onOpenDay(day)}>{t('Ver {count} más', { count: items.length - 3 })}</button>}</div>
        </td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
