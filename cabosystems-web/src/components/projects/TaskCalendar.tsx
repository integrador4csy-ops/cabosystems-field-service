import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { CalendarTaskPreview } from './CalendarTaskPreview';
import { dateKey, monthWorkWeeks, parseDateKey } from '../../lib/taskDates';
import type { Tarea } from '../../types/projects';

interface TaskCalendarProps {
  tasks: Tarea[];
  selectedDate: string;
  projectLabels: Record<string, string>;
  onOpenDay: (day: string) => void;
  onCreateTask: (day: string) => void;
}

export function TaskCalendar({ tasks, selectedDate, projectLabels, onOpenDay, onCreateTask }: TaskCalendarProps) {
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
          <div className="agenda-month-day-heading"><button type="button" className="agenda-month-date" aria-label={t('Ver tareas del {date}', { date: dateLabel })} aria-current={day === today ? 'date' : undefined} onClick={() => onOpenDay(day)}>{parseDateKey(day).getDate()}</button><div className="agenda-day-actions">{items.length > 0 && <span className="agenda-count">{items.length}</span>}<button type="button" className="agenda-create-task" aria-label={t('Crear tarea para el {date}', { date: dateLabel })} onClick={() => onCreateTask(day)}><Plus size={16} aria-hidden="true" /></button></div></div>
          <div className="agenda-month-tasks">{items.slice(0, 3).map((task) => <CalendarTaskPreview key={task.id} task={task} projectLabel={projectLabels[task.proyecto_id]} onViewDetails={() => onOpenDay(day)} />)}{items.length > 3 && <button type="button" className="agenda-month-more" onClick={() => onOpenDay(day)}>{t('Ver {count} más', { count: items.length - 3 })}</button>}</div>
        </td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
