import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { CompanyAgendaControls } from '@/components/agenda/CompanyAgendaControls';
import { CompanyCalendarFilters } from '@/components/agenda/CompanyCalendarFilters';
import { CompanyAgendaEvent } from '@/components/agenda/CompanyAgendaEvent';
import { COMPANY_AGENDA_COPY } from '@/lib/companyAgendaCopy';
import { companyDays, type CompanyView } from '@/lib/companyAgenda';
import { parseDateKey, shiftDate, shiftMonth } from '@/lib/agenda';
import { NO_RECURRENCE } from '@/lib/companyAgendaRecurrence';
import './preview.css';
function Preview() {
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
  const locale = language === 'es' ? 'es-MX' : 'en-US';
  const c = COMPANY_AGENDA_COPY[language];
  const [anchor, setAnchor] = useState('2026-10-23');
  const [view, setView] = useState<CompanyView>('month');
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const days = companyDays(anchor, view);
  const heading = view === 'month' ? parseDateKey(anchor).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : view === 'day' ? parseDateKey(anchor).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) : `${days[0]} – ${days.at(-1)}`;
  const event = { ...NO_RECURRENCE, id: 'sample', titulo: 'Revisión de instalación', fecha: anchor, hora: '09:00', tipo: 'evento' as const, ubicacion: 'Oficina CaboSystems', descripcion: null, created_at: '' };
  return <main><p className="preview-note">{language === 'es' ? 'Vista de diseño · Datos de ejemplo' : 'Design preview · Sample data'}</p><View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
    <CompanyAgendaControls copy={c} locale={locale} query={query} view={view} anchor={anchor} today="2026-10-23" days={days} counts={new Map(hidden.includes('local') || (query && !event.titulo.toLowerCase().includes(query.toLowerCase())) ? [] : [[anchor, 1]])} heading={heading} onSearch={setQuery} onView={setView} onDate={setAnchor} onMove={direction => setAnchor(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)))} onToday={() => setAnchor('2026-10-23')} />
    <CompanyCalendarFilters locale={locale} calendars={[{ id: 'local', name: 'CaboSystems' }, { id: 'office', name: 'Oficina' }, { id: 'team', name: 'Equipo de instalación' }]} hidden={hidden} onToggle={id => setHidden(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])} />
    <Text style={{ fontSize: 14, fontWeight: '600', paddingTop: 24, color: '#000000' }}>{parseDateKey(anchor).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
    {!hidden.includes('local') && (!query || event.titulo.toLowerCase().includes(query.toLowerCase())) ? <CompanyAgendaEvent event={event} time="09:00" schedule="09:00 – 10:00" type={c.event} repeats={c.repeats} onOpen={() => {}} /> : <Text style={{ paddingVertical: 24 }}>{c.emptyFilter}</Text>}
  </View></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
