import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, RefreshCw } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaPalette as P } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { dateKey, parseDateKey } from '@/lib/agenda';
import { moveAgendaPeriod } from '@/lib/agendaGestures';
import { getAgendaWindow } from '@/lib/agendaWindowService';
import { canManageCompanyAgenda, companyDays, companyRows, type CompanyRow, type CompanyView } from '@/lib/companyAgenda';
import { saveCompanyEvent, deleteCompanyEvent } from '@/lib/companyAgendaApi';
import { cacheCompanyAgenda, readCompanyAgendaCache } from '@/lib/companyAgendaCache';
import { COMPANY_AGENDA_COPY } from '@/lib/companyAgendaCopy';
import { eventSchedule } from '@/lib/companyAgendaPresentation';
import { supabase } from '@/lib/supabase';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput } from '@/types/companyAgenda';
import { CompanyAgendaControls, CompanyAgendaGrid, CompanyAgendaTopBar } from './CompanyAgendaControls';
import { CompanyAgendaEvent } from './CompanyAgendaEvent';
import { AgendaSearchClient } from '@/lib/agendaSearchClient';
import { startForegroundPolling } from '@/lib/foregroundPolling';
import { afterTabPaint } from '@/lib/tabPreparation';
import { CompanyAgendaSearchResults } from './CompanyAgendaSearchResults';
import { CompanyCalendarFilters } from './CompanyCalendarFilters';
import { CompanyEventModal } from './CompanyEventModal';
import { AgendaSwipeArea } from './AgendaSwipeArea';
import { AgendaNativePager } from './AgendaNativePager';
import { AgendaPreviewCache } from '@/lib/agendaPreviewCache';

import { useCalendarColors } from '@/lib/useCalendarColors';

const EMPTY: CompanyEvent[] = [];

// Focus changes only update the gesture gate, not the entire seven-page agenda.
function FocusAwareAgendaSwipeArea(props: React.ComponentProps<typeof AgendaSwipeArea>) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return <AgendaSwipeArea {...props} enabled={props.enabled && focused} />;
}

function FocusAwareAgendaNativePager(props: React.ComponentProps<typeof AgendaNativePager>) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <AgendaNativePager {...props} enabled={props.enabled && focused} />;
}

export default function CompanyAgendaScreen() {
  const { profile } = useAuth(); const owner = profile?.activo ? profile.id : '';
  const windowManager = useMemo(() => getAgendaWindow(owner), [owner]);
  const periodCache = windowManager.cache;
  const [previewRevision, updatePreviews] = useState(0);
  const previewCache = useMemo(() => new AgendaPreviewCache<React.ReactNode>(), [owner]);
  const nativePageCache = useMemo(() => new AgendaPreviewCache<React.ReactElement>(12), [owner]);
  const isPreReady = Boolean(owner && windowManager.ready);
  const [hydratedOwner, setHydratedOwner] = useState<string | null>(() => (isPreReady ? owner : null));
  const initializedOwner = useRef<string | null>(isPreReady ? owner : null);
  const hydrated = hydratedOwner === owner && windowManager.ready;
  const personalColors = useCalendarColors(owner);
  useFocusEffect(useCallback(() => afterTabPaint(() => { void personalColors.reload(); }), [personalColors.reload]));
  const canManage = canManageCompanyAgenda(profile);
  const { language } = useTranslation(); const c = COMPANY_AGENDA_COPY[language];
  const locale = language === 'es' ? 'es-MX' : 'en-US'; const insets = useSafeAreaInsets();
  const [{ anchor, position, pageEpoch }, setPeriod] = useState(() => ({
    anchor: isPreReady ? windowManager.anchor : dateKey(new Date()),
    position: 0,
    pageEpoch: 0,
  }));
  const setAnchor = useCallback((anchor: string) => setPeriod(current => ({ anchor, position: 0, pageEpoch: current.pageEpoch + 1 })), []);
  const [view, setView] = useState<CompanyView>(() => (isPreReady ? windowManager.view : 'month'));
  const nativePaging = view === 'month';
  const [today, setToday] = useState(() => dateKey(new Date())); const [query, setQuery] = useState('');
  const [data, setData] = useState<{ owner: string; from: string; to: string; items: CompanyEvent[] }>({ owner: '', from: '', to: '', items: [] });
  const initialDays = useMemo(() => companyDays(isPreReady ? windowManager.anchor : dateKey(new Date()), isPreReady ? windowManager.view : 'month'), [isPreReady, windowManager]);
  const hasInitialCache = periodCache.read(initialDays[0], initialDays[initialDays.length - 1]) !== null;
  const [loading, setLoading] = useState(() => !hasInitialCache); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(false); const [cached, setCached] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialog, setDialog] = useState<{ owner: string; event: CompanyEvent | null; day: string } | null>(null);
  const [calendars, setCalendars] = useState<{ owner: string; items: AgendaGoogleCalendar[] }>({ owner: '', items: [] });
  const [hiddenCalendars, setHiddenCalendars] = useState<string[]>([]);
  const sequence = useRef(0);
  const days = useMemo(() => companyDays(anchor, view), [anchor, view]);
  const from = days[0];
  const to = days[days.length - 1];
  const visibleRange = useRef({ from, to });
  visibleRange.current = { from, to };
  const events = periodCache.read(from, to) ?? (data.owner === owner && data.from === from && data.to === to ? data.items : EMPTY);
  const load = useCallback(async (refresh: boolean | 'silent' = false) => {
    if (!hydrated) return;
    const request = ++sequence.current;
    if (!owner) { setData({ owner: '', from, to, items: [] }); setLoading(false); setRefreshing(false); return; }
    if (refresh === true) setRefreshing(true); else if (refresh === false && periodCache.read(from, to) === null) setLoading(true);
    try {
      const [items, available] = await Promise.all([periodCache.load(from, to, refresh !== false), windowManager.getCalendars(refresh !== false)]);
      if (request !== sequence.current) return;
      setData(current => current.owner === owner && current.from === from && current.to === to && current.items === items ? current : { owner, from, to, items }); setCached(false); setError(false); setErrorMessage('');
      setCalendars(current => current.owner === owner && current.items === available ? current : { owner, items: available });
      void cacheCompanyAgenda(owner, from, to, items);
    } catch (reason) {
      const items = periodCache.read(from, to) ?? await readCompanyAgendaCache(owner, from, to);
      if (request !== sequence.current) return;
      setData({ owner, from, to, items: items || [] }); setCached(items !== null); setError(true);
      setErrorMessage(reason instanceof Error ? reason.message : '');
    } finally { if (request === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, [owner, from, to, periodCache, windowManager, hydrated]);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      if (windowManager.ready && initializedOwner.current !== owner) {
        initializedOwner.current = owner;
        setAnchor(windowManager.anchor); setView(windowManager.view); setHydratedOwner(owner);
      }
      setCalendars(current => current.owner === owner && current.items === windowManager.calendars ? current : { owner, items: windowManager.calendars });
      startTransition(() => updatePreviews(value => value + 1));
      if (periodCache.read(visibleRange.current.from, visibleRange.current.to) !== null) {
        setLoading(false);
      }
    };
    const stop = windowManager.subscribe(update);
    void windowManager.initialize().then(update); update();
    return () => { active = false; stop(); };
  }, [owner, windowManager, periodCache]);
  useEffect(() => { if (hydrated) windowManager.select(anchor, view); }, [hydrated, windowManager, anchor, view]);
  useEffect(() => {
    if (!hydrated || !owner) return;
    if (periodCache.read(from, to) === null) {
      void load('silent');
    }
  }, [hydrated, owner, from, to, load, periodCache]);
  useEffect(() => { setHiddenCalendars([]); setErrorMessage(''); }, [owner]);
  const [searchRevision, setSearchRevision] = useState(0);
  const searchClient = useMemo(() => new AgendaSearchClient(), [owner]);
  useFocusEffect(useCallback(() => {
    if (!owner) return;
    return afterTabPaint(() => {
      const stopPolling = startForegroundPolling(() => searchClient.prepare(), 25_000);
      return () => { stopPolling(); searchClient.clear(); };
    });
  }, [owner, searchClient, searchRevision]));

  useFocusEffect(useCallback(() => {
    return afterTabPaint(() => {
    let timer: ReturnType<typeof setTimeout> | undefined; let active = true;
    let initialLoad = true;
    const stopRefreshing = startForegroundPolling(() => {
      if (!active) return;
      const mode = initialLoad ? false : 'silent'; initialLoad = false;
      return load(mode);
    }, 60_000);
    const reload = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { if (active && AppState.currentState === 'active') void load('silent'); }, 300); };
    const channel = owner ? supabase.channel(`company_agenda_mobile_${owner}_${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, reload).subscribe() : null;
    const stopDateUpdates = startForegroundPolling(() => setToday(dateKey(new Date())), 60_000);
    return () => { active = false; sequence.current++; if (timer) clearTimeout(timer); stopRefreshing(); stopDateUpdates(); if (channel) void supabase.removeChannel(channel); };
    });
  }, [load, owner]));



  const rows = useMemo(() => companyRows(events.filter(event => !hiddenCalendars.includes(event.google?.calendarId || 'local')), query, ''), [events, query, hiddenCalendars]);
  const calendarFilters = useMemo(() => [{ id: 'local', name: 'CaboSystems', backgroundColor: P.slate }, ...(calendars.owner === owner ? calendars.items : [])], [calendars.owner, calendars.items, owner]);
  const toggleCalendar = (id: string) => setHiddenCalendars(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale]);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }), [locale]);
  const swipeMove = useCallback((direction: number, requestedPosition?: number, requestedAnchor?: string) => {
    // The UI-thread pager accepts the next gesture immediately. Updating the
    // heading/grid is interruptible and follows its latest absolute position.
    startTransition(() => setPeriod(current => {
      if (current.pageEpoch !== pageEpoch) return current;
      const position = requestedPosition ?? current.position + direction;
      const anchor = requestedAnchor ?? moveAgendaPeriod(current.anchor, view, position - current.position);
      if (anchor === current.anchor) return current;
      return nativePaging && Math.abs(position) >= 10 ? { anchor, position: 0, pageEpoch: current.pageEpoch + 1 } : { ...current, anchor, position };
    }));
  }, [view, nativePaging, pageEpoch]);
  const move = useCallback((direction: number) => setPeriod(current => {
    const anchor = moveAgendaPeriod(current.anchor, view, direction);
    return anchor === current.anchor ? current : { anchor, position: 0, pageEpoch: current.pageEpoch + 1 };
  }), [view]);
  const headingFormats = useMemo(() => ({ month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), start: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), end: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }) }), [locale]);
  const periodHeading = (anchor: string, days: string[]) => view === 'day' ? dateFormat.format(parseDateKey(anchor)) : view === 'week' ? `${headingFormats.start.format(parseDateKey(days[0]))} – ${headingFormats.end.format(parseDateKey(days[days.length - 1]))}` : headingFormats.month.format(parseDateKey(anchor));
  const save = async (id: string | undefined, input: EventInput) => { await saveCompanyEvent(id, input); windowManager.invalidate(); setSearchRevision(value => value + 1); void load(true); };
  const remove = async (id: string, etag?: string) => { await deleteCompanyEvent(id, etag); windowManager.invalidate(); setSearchRevision(value => value + 1); void load(true); };
  const openEvent = useCallback((event: CompanyEvent) => setDialog({ owner, event, day: event.occurrence_date || event.fecha }), [owner]);
  const renderRow = useCallback(({ item }: { item: CompanyRow }) => {
    if (item.kind === 'heading') return <View style={s.dayHeading}><Text style={s.dayTitle}>{dateFormat.format(parseDateKey(item.date))}</Text><Text style={s.count}>{item.count}</Text></View>;
    const event = item.event;
    const date = event.occurrence_date || event.fecha;
    return <CompanyAgendaEvent color={personalColors.colors[event.google?.calendarId || 'local']} event={event} schedule={eventSchedule(event, locale)} time={event.google && date !== event.fecha ? c.continues : event.hora ? timeFormat.format(new Date(`${event.fecha}T${event.hora}`)) : c.allDay} type={c.event} repeats={c.repeats} onOpen={openEvent} />;
  }, [c, dateFormat, timeFormat, openEvent, locale, personalColors.colors]);
  const countsFor = (pageRows: CompanyRow[]) => new Map(pageRows.filter((row): row is Extract<CompanyRow, { kind: 'heading' }> => row.kind === 'heading').map(row => [row.date, row.count]));
  const counts = useMemo(() => countsFor(rows), [rows]);
  const renderPeriodHeader = useCallback((pageAnchor: string, pageDays: string[], pageRows: CompanyRow[]) => <View style={s.calendarEdge}><CompanyAgendaGrid copy={c} locale={locale} view={view} anchor={pageAnchor} today={today} days={pageDays} counts={countsFor(pageRows)} onDate={setAnchor} onView={setView} /></View>, [c, locale, view, today, setAnchor]);
  const controls = <View style={s.fixedControls}>
    <CompanyAgendaControls showCalendar={false} calendarFilter={<CompanyCalendarFilters key={owner} colors={personalColors.colors} loadingColors={personalColors.loading} colorsFailed={personalColors.failed} onRetryColors={personalColors.reload} onSaveColor={personalColors.save} calendars={calendarFilters} hidden={hiddenCalendars} locale={locale} onToggle={toggleCalendar} />} copy={c} locale={locale} query={query} view={view} anchor={anchor} today={today} days={days} counts={counts} heading={periodHeading(anchor, days)} onSearch={setQuery} onView={setView} onDate={setAnchor} onMove={move} onToday={() => setAnchor(dateKey(new Date()))} />
    {!query.trim() && error ? <View accessibilityRole="alert" style={s.error}><Text style={[s.help, s.errorCopy]}>{errorMessage || c.failed}{cached ? `\n${c.cached}` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.retry} onPress={() => void load(true)} style={s.icon}><RefreshCw size={18} color={P.ink} /></Pressable></View> : null}
  </View>;
  const header = useMemo(() => query.trim() ? <View /> : renderPeriodHeader(anchor, days, rows), [query, renderPeriodHeader, anchor, days, rows]);
  const refreshCurrent = useRef(load);
  refreshCurrent.current = load;
  const refreshNativePage = useCallback(() => { void refreshCurrent.current(true); }, []);
  const nativePage = useCallback((pageAnchor: string) => {
    const pageDays = companyDays(pageAnchor, view);
    const items = periodCache.read(pageDays[0], pageDays[pageDays.length - 1]);
    return nativePageCache.get(`${owner}:${view}:${pageAnchor}`, [items, personalColors.colors, hiddenCalendars, searchRevision, today, locale, insets.bottom, openEvent, renderRow, renderPeriodHeader, searchClient, c, refreshing], () => {
      const pageRows = companyRows((items || EMPTY).filter(event => !hiddenCalendars.includes(event.google?.calendarId || 'local')), '', '');
      return <CompanyAgendaSearchResults periodKey={`${view}:${pageAnchor}`} colors={personalColors.colors} client={searchClient} query="" today={today} locale={locale} hiddenCalendars={hiddenCalendars} revision={searchRevision} header={renderPeriodHeader(pageAnchor, pageDays, pageRows)} bottomInset={insets.bottom} onOpen={openEvent} onClear={() => {}} onDate={setAnchor} fallback={{ rows: pageRows, renderItem: renderRow, refreshing, onRefresh: refreshNativePage, empty: <View style={s.empty}>{items === null ? <ActivityIndicator color={P.accent} /> : <CalendarDays size={26} color={P.slate} />}<Text style={s.emptyText}>{items === null ? c.loading : c.empty}</Text></View> }} />;
    });
  }, [owner, view, periodCache, nativePageCache, personalColors.colors, hiddenCalendars, searchRevision, today, locale, insets.bottom, openEvent, renderRow, renderPeriodHeader, searchClient, c, refreshing, refreshNativePage, setAnchor, previewRevision]);
  const preview = useCallback((direction: number) => {
    const pageAnchor = moveAgendaPeriod(anchor, view, direction);
    if (pageAnchor === anchor || query.trim()) return null;
    const pageDays = companyDays(pageAnchor, view);
    const items = periodCache.read(pageDays[0], pageDays[pageDays.length - 1]);
    return previewCache.get(`${owner}:${view}:${pageAnchor}`, [items, personalColors.colors, hiddenCalendars, searchRevision, today, locale, insets.bottom, openEvent, renderRow, renderPeriodHeader, searchClient, c], () => {
    const pageRows = companyRows((items || EMPTY).filter(event => !hiddenCalendars.includes(event.google?.calendarId || 'local')), '', '');
    return <CompanyAgendaSearchResults preview key={`${owner}:${view}:${pageAnchor}`} colors={personalColors.colors} client={searchClient} query="" today={today} locale={locale} hiddenCalendars={hiddenCalendars} revision={searchRevision} header={renderPeriodHeader(pageAnchor, pageDays, pageRows)} bottomInset={insets.bottom} onOpen={openEvent} onClear={() => {}} onDate={() => {}} fallback={{ rows: pageRows, renderItem: renderRow, refreshing: false, onRefresh: () => {}, empty: <View style={s.empty}>{items === null ? <ActivityIndicator color={P.accent} /> : <CalendarDays size={26} color={P.slate} />}<Text style={s.emptyText}>{items === null ? c.loading : c.empty}</Text></View> }} />;
    });
  }, [anchor, view, query, owner, hiddenCalendars, searchRevision, today, locale, insets.bottom, periodCache, personalColors.colors, openEvent, renderRow, renderPeriodHeader, searchClient, c, previewCache, previewRevision]);
  const { previousPages, nextPages } = useMemo(() => {
    if (nativePaging && !query.trim()) return { previousPages: [], nextPages: [] };
    // Evict pages leaving the window before adding new ones. Otherwise inserting
    // the first new page evicts a still-needed neighbor and cascades cache misses.
    previewCache.retain([-1, -2, -3, 1, 2, 3].map(direction => `${owner}:${view}:${moveAgendaPeriod(anchor, view, direction)}`));
    return { previousPages: [-1, -2, -3].map(preview), nextPages: [1, 2, 3].map(preview) };
  }, [preview, previewCache, owner, view, anchor, nativePaging, query]);
  return <View style={s.page}>
    <StatusBar style="dark" />
    <CompanyAgendaTopBar copy={c} canManage={canManage} onCreate={() => setDialog({ owner, event: null, day: anchor })} />
    {hydrated ? <>
    {controls}
    {nativePaging && !query.trim() ? <FocusAwareAgendaNativePager key={`${owner}:${view}:${pageEpoch}`} anchor={anchor} pagePosition={position} view={view} enabled={hydrated && !dialog} renderPage={nativePage} onMove={swipeMove} style={s.listArea} /> : <FocusAwareAgendaSwipeArea scopeKey={`${owner}:${view}:${pageEpoch}`} pagePosition={position} previousPages={previousPages} nextPages={nextPages} periodKey={`${owner}:${view}:${from}:${to}`} canGoPrevious={moveAgendaPeriod(anchor, view, -1) !== anchor} canGoNext={moveAgendaPeriod(anchor, view, 1) !== anchor} style={s.listArea} enabled={hydrated && !query.trim() && !dialog} onMove={swipeMove}><CompanyAgendaSearchResults periodKey={`${view}:${from}:${to}`} colors={personalColors.colors} client={searchClient} key={owner} query={query.trim()} today={today} locale={locale} hiddenCalendars={hiddenCalendars} revision={searchRevision} header={header} bottomInset={insets.bottom} onOpen={openEvent} onClear={() => setQuery('')} onDate={day => { setQuery(''); setAnchor(day); setView('day'); }} fallback={{ rows, renderItem: renderRow, refreshing, onRefresh: () => void load(true), empty: loading && periodCache.read(from, to) === null ? <View style={s.empty}><ActivityIndicator color={P.accent} /><Text style={s.help}>{c.loading}</Text></View> : <View style={s.empty}><CalendarDays size={26} color={P.slate} /><Text style={s.emptyText}>{c.empty}</Text></View> }} /></FocusAwareAgendaSwipeArea>}
    </> : <View style={s.boot}><ActivityIndicator color={P.accent} /></View>}
    {dialog && dialog.owner === owner ? <CompanyEventModal key={`${owner}-${dialog.event?.id || dialog.day}`} event={dialog.event} day={dialog.day} canManage={canManage} copy={c} locale={locale} onClose={() => setDialog(null)} onSave={save} onDelete={remove} /> : null}
  </View>;
}
const s = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: P.white },
  fixedControls: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, backgroundColor: P.white },
  calendarEdge: { marginHorizontal: -20 },
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
