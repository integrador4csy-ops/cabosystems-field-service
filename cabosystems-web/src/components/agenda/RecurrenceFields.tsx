import { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { isoWeekday } from '../../lib/agendaRecurrence';
import { parseDateKey } from '../../lib/taskDates';
import type { EventInput, RecurrenceFrequency } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';

type RepeatMode = 'ninguna' | 'semanal' | 'mensual' | 'custom';

export function RecurrenceFields({ input, disabled, onChange }: {
  input: EventInput; disabled: boolean; onChange: (patch: Partial<EventInput>) => void;
}) {
  const { t, locale } = useTranslation();
  const [mode, setMode] = useState<RepeatMode>(() => input.intervalo > 1 || input.repeticion === 'diaria' ? 'custom' : input.repeticion);
  const [endsOnDate, setEndsOnDate] = useState(input.repetir_hasta !== null);
  const weekday = isoWeekday(input.fecha);
  const defaultDay = Number.isFinite(weekday) ? weekday : 1;
  const selectMode = (value: RepeatMode) => {
    setMode(value);
    const frequency = value === 'custom' ? 'semanal' : value;
    if (frequency === 'ninguna') setEndsOnDate(false);
    onChange({ repeticion: frequency, intervalo: 1, dias_semana: frequency === 'semanal' ? [defaultDay] : [], repetir_hasta: frequency === 'ninguna' ? null : input.repetir_hasta });
  };
  const frequencyChanged = (frequency: RecurrenceFrequency) => onChange({ repeticion: frequency, dias_semana: frequency === 'semanal' ? [defaultDay] : [] });
  return <div className="company-recurrence">
    <label>{t('Repetir')}<AppSelect aria-label={t('Repetir')} disabled={disabled} value={mode} onChange={(e) => selectMode(e.target.value as RepeatMode)}>
      <option value="ninguna">{t('No repetir')}</option><option value="semanal">{t('Cada semana')}</option><option value="mensual">{t('Cada mes')}</option><option value="custom">{t('Personalizado')}</option>
    </AppSelect></label>
    {mode === 'custom' && <div className="company-repeat-interval"><label>{t('Repetir cada')}<input aria-label={t('Intervalo de repetición')} required type="number" min={1} max={365} step={1} value={input.intervalo || ''} onChange={(e) => onChange({ intervalo: Number(e.target.value) })} /></label><label>{t('Unidad de repetición')}<AppSelect aria-label={t('Unidad de repetición')} disabled={disabled} value={input.repeticion} onChange={(e) => frequencyChanged(e.target.value as RecurrenceFrequency)}><option value="diaria">{t('Días')}</option><option value="semanal">{t('Semanas')}</option><option value="mensual">{t('Meses')}</option></AppSelect></label></div>}
    {input.repeticion === 'semanal' && <div className="company-weekday-field"><span id="repeat-weekdays-label">{t('Días de la semana')}</span><div className="company-weekdays" role="group" aria-labelledby="repeat-weekdays-label">{Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      const date = new Date(2024, 0, day, 12);
      const selected = input.dias_semana.includes(day);
      return <button key={day} type="button" disabled={disabled} aria-label={date.toLocaleDateString(locale, { weekday: 'long' })} aria-pressed={selected} onClick={() => onChange({ dias_semana: selected ? input.dias_semana.filter((value) => value !== day) : [...input.dias_semana, day].sort((a, b) => a - b) })}>{date.toLocaleDateString(locale, { weekday: 'short' })}</button>;
    })}</div>{input.dias_semana.length === 0 && <p className="company-error">{t('Selecciona al menos un día de la semana.')}</p>}</div>}
    {input.repeticion === 'mensual' && input.fecha && <p className="company-field-help">{t('Se usa el día {day}; si no existe en ese mes, se usa el último día.', { day: parseDateKey(input.fecha).getDate() })}</p>}
    {input.repeticion !== 'ninguna' && <div className="company-form-row"><label>{t('Termina')}<AppSelect aria-label={t('Termina')} disabled={disabled} value={endsOnDate ? 'date' : 'never'} onChange={(e) => { const ends = e.target.value === 'date'; setEndsOnDate(ends); onChange({ repetir_hasta: ends ? input.fecha : null }); }}><option value="never">{t('Nunca')}</option><option value="date">{t('En una fecha')}</option></AppSelect></label>{endsOnDate && <label>{t('Repetir hasta')}<input type="date" required min={input.fecha} max="9999-12-31" value={input.repetir_hasta || ''} onChange={(e) => onChange({ repetir_hasta: e.target.value })} /></label>}</div>}
  </div>;
}
