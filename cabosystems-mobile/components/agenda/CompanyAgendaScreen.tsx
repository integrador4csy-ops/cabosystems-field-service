import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { CalendarDays, RefreshCw } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaPalette as P } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { dateKey, parseDateKey, shiftDate, shiftMonth } from '@/lib/agenda';
import { canManageCompanyAgenda, companyDays, companyRows, type CompanyRow, type CompanyView } from '@/lib/companyAgenda';
import { getCompanyEvents, getGoogleCalendars, saveCompanyEvent, deleteCompanyEvent } from '@/lib/companyAgendaApi';
import { cacheCompanyAgenda, readCompanyAgendaCache } from '@/lib/companyAgendaCache';
import { COMPANY_AGENDA_COPY } from '@/lib/companyAgendaCopy';
import { eventSchedule } from '@/lib/companyAgendaPresentation';
import { supabase } from '@/lib/supabase';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput } from '@/types/companyAgenda';
import { CompanyAgendaControls, CompanyAgendaTopBar } from './CompanyAgendaControls';
import { CompanyAgendaEvent } from './CompanyAgendaEvent';
import { CompanyCalendarFilters } from './CompanyCalendarFilters';
import { CompanyEventModal } from './CompanyEventModal';

const EMPTY: CompanyEvent[] = [];
const rowKey = (row: CompanyRow) => row.kind === 'heading' ? `heading-${row.date}` : `${row.event.id}-${row.event.occurrence_date || row.event.fecha}`;
const rowType = (row: CompanyRow) => row.kind;

export default function CompanyAgendaScreen() {
  const { profile } = useAuth(); const owner = profile?.activo ? profile.id : '';
  const canManage = canManageCompanyAgenda(profile);
  const { language } = useTranslation(); const c = COMPANY_AGENDA_COPY[language];
  const locale = language === 'es' ? 'es-MX' : 'en-US'; const insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState(() => dateKey(new Date())); const [view, setView] = useState<CompanyView>('month');
  const [today, setToday] = useState(() => dateKey(new Date())); const [query, setQuery] = useState('');
  const [data, setData] = useState<{ owner: string; from: string; to: string; items: CompanyEvent[] }>({ owner: '', from: '', to: '', items: [] });
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(false); const [cached, setCached] = useState(false);
  const [dialog, setDialog] = useState<{ owner: string; event: CompanyEvent | null; day: string } | null>(null);
  const [calendars, setCalendars] = useState<{ owner: string; items: AgendaGoogleCalendar[] }>({ owner: '', items: [] });
  const [hiddenCalendars, setHiddenCalendars] = useState<string[]>([]);
  useEffect(() => setHiddenCalendars([]), [owner]);
  const sequence = useRef(0);
  const days = useMemo(() => companyDays(anchor, view), [anchor, view]); const from = days[0]; const to = days[days.length - 1];
  const events = data.owner === owner && data.from === from && data.to === to ? data.items : EMPTY;
  const load = useCallback(async (refresh = false) => {
    const request = ++sequence.current;
    if (!owner) { setData({ owner: '', from, to, items: [] }); setLoading(false); setRefreshing(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [items, available] = await Promise.all([getCompanyEvents(from, to), getGoogleCalendars()]);
      if (request !== sequence.current) return;
      setData({ owner, from, to, items }); setCached(false); setError(false);
      setCalendars({ owner, items: available });
      void cacheCompanyAgenda(owner, from, to, items);
    } catch {
      const items = await readCompanyAgendaCache(owner, from, to);
      if (request !== sequence.current) return;
      setData({ owner, from, to, items: items || [] }); setCached(items !== null); setError(true);
    } finally { if (request === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, [owner, from, to]);

  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | undefined; let active = true;
    void load();
    const reload = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { if (active) void load(true); }, 300); };
    const channel = owner ? supabase.channel(`company_agenda_mobile_${owner}_${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, reload).subscribe() : null;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') reload(); });
    const midnight = setInterval(() => setToday(dateKey(new Date())), 60_000);
    return () => { active = false; sequence.current++; if (timer) clearTimeout(timer); clearInterval(midnight); listener.remove(); if (channel) void supabase.removeChannel(channel); };
  }, [load, owner]));

  const rows = useMemo(() => companyRows(events.filter(event => !hiddenCalendars.includes(event.google?.calendarId || 'local')), query, ''), [events, query, hiddenCalendars]);
  const calendarFilters = [{ id: 'local', name: 'CaboSystems', backgroundColor: P.slate }, ...(calendars.owner === owner ? calendars.items : [])];
  const toggleCalendar = (id: string) => setHiddenCalendars(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const counts = useMemo(() => new Map(rows.filter((row): row is Extract<CompanyRow, { kind: 'heading' }> => row.kind === 'heading').map(row => [row.date, row.count])), [rows]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale]);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }), [locale]);
  const move = (direction: number) => setAnchor(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)));
  const heading = view === 'day' ? dateFormat.format(parseDateKey(anchor)) : view === 'week' ? `${parseDateKey(from).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${parseDateKey(to).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : parseDateKey(anchor).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const save = async (id: string | undefined, input: EventInput) => { await saveCompanyEvent(id, input); void load(true); };
  const remove = async (id: string, etag?: string) => { await deleteCompanyEvent(id, etag); void load(true); };
  const openEvent = useCallback((event: CompanyEvent) => setDialog({ owner, event, day: event.occurrence_date || event.fecha }), [owner]);
  const renderRow = useCallback(({ item }: { item: CompanyRow }) => {
    if (item.kind === 'heading') return <View style={s.dayHeading}><Text style={s.dayTitle}>{dateFormat.format(parseDateKey(item.date))}</Text><Text style={s.count}>{item.count}</Text></View>;
    const event = item.event;
    const date = event.occurrence_date || event.fecha;
    return <CompanyAgendaEvent event={event} schedule={eventSchedule(event, locale)} time={event.google && date !== event.fecha ? c.continues : event.hora ? timeFormat.format(new Date(`${event.fecha}T${event.hora}`)) : c.allDay} type={c.event} repeats={c.repeats} onOpen={openEvent} />;
  }, [c, dateFormat, timeFormat, openEvent, locale]);
  const extra = useMemo(() => ({ c, locale, owner }), [c, locale, owner]);
  const header = <View>
    <CompanyAgendaControls copy={c} locale={locale} query={query} view={view} anchor={anchor} today={today} days={days} counts={counts} heading={heading} onSearch={setQuery} onView={setView} onDate={setAnchor} onMove={move} onToday={() => setAnchor(dateKey(new Date()))} />
    <CompanyCalendarFilters calendars={calendarFilters} hidden={hiddenCalendars} locale={locale} onToggle={toggleCalendar} />
    {error ? <View accessibilityRole="alert" style={s.error}><Text style={[s.help, s.errorCopy]}>{cached ? c.cached : c.failed}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.retry} onPress={() => void load(true)} style={s.icon}><RefreshCw size={18} color={P.ink} /></Pressable></View> : null}
  </View>;
  return <View style={s.page}>
    <StatusBar style="dark" />
    <CompanyAgendaTopBar copy={c} canManage={canManage} onCreate={() => setDialog({ owner, event: null, day: anchor })} />
    <View style={s.listArea}><FlashList data={rows} keyExtractor={rowKey} getItemType={rowType} renderItem={renderRow} extraData={extra} ListHeaderComponent={header} ListEmptyComponent={loading ? <View style={s.empty}><ActivityIndicator color={P.accent} /><Text style={s.help}>{c.loading}</Text></View> : <View style={s.empty}><CalendarDays size={26} color={P.slate} /><Text style={s.emptyText}>{query.trim() ? c.emptyFilter : c.empty}</Text></View>} refreshing={refreshing} onRefresh={() => void load(true)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }} /></View>
    {dialog && dialog.owner === owner ? <CompanyEventModal key={`${owner}-${dialog.event?.id || dialog.day}`} event={dialog.event} day={dialog.day} canManage={canManage} copy={c} locale={locale} onClose={() => setDialog(null)} onSave={save} onDelete={remove} /> : null}
  </View>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.white },
  listArea: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 2 },
  dayTitle: { flex: 1, color: P.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 14, textTransform: 'capitalize' },
  count: { color: P.muted, fontFamily: 'Outfit_400Regular', fontSize: 12 },
  empty: { paddingHorizontal: 16, paddingVertical: 36, gap: 12, alignItems: 'center' },
  emptyText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  help: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 20 },
  errorCopy: { flex: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingLeft: 12, marginTop: 16 },
  icon: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
