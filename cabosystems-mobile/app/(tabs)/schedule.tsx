import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { CalendarDays, ChevronLeft, ChevronRight, Search, X, RefreshCw } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaPalette as P } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { useTranslation } from '@/lib/i18n';
import { getMyTasks, type TaskWithProject } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/database';
import { AGENDA_COPY } from '@/lib/agendaCopy';
import { agendaRows, dateKey, filterAgendaTasks, parseDateKey, periodTasks, shiftDate, shiftMonth, weekDates, type AgendaRow, type AgendaStatus, type AgendaView } from '@/lib/agenda';
import { AgendaHeader } from '@/components/agenda/AgendaHeader';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import { AgendaTaskCard } from '@/components/agenda/AgendaTaskCard';

const EMPTY_TASKS: TaskWithProject[] = [];
const views = ['month', 'day', 'week', 'unscheduled'] as const;
const statuses = ['all', 'pendiente', 'en_proceso', 'completada'] as const;
const rowKey = (row: AgendaRow) => row.kind === 'task' ? row.task.id : `${row.kind}-${row.date}`;
const rowType = (row: AgendaRow) => row.kind;

export default function ScheduleScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const { profile } = useAuth(); const userId = profile?.id || '';
  const { projects, selectedProjectId, setSelectedProject } = useProjects();
  const { language } = useTranslation(); const c = AGENDA_COPY[language]; const locale = language === 'es' ? 'es-MX' : 'en-US';
  const [data, setData] = useState<{ owner: string; items: TaskWithProject[] }>({ owner: '', items: [] });
  const tasks = data.owner === userId ? data.items : EMPTY_TASKS;
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(false);
  const [view, setView] = useState<AgendaView>('day'); const [date, setDate] = useState(() => dateKey(new Date()));
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [status, setStatus] = useState<AgendaStatus>('all'); const [query, setQuery] = useState(''); const [searchOpen, setSearchOpen] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const request = useRef(0); const list = useRef<FlashListRef<AgendaRow>>(null);
  const projectId = allProjects ? undefined : selectedProjectId;

  const load = useCallback(async (refresh = false) => {
    const sequence = ++request.current;
    if (!userId) { setData({ owner: '', items: [] }); setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(false); setToday(dateKey(new Date()));
    try {
      const items = await getMyTasks(userId);
      if (sequence === request.current) setData({ owner: userId, items });
    } catch { if (sequence === request.current) setError(true); }
    finally { if (sequence === request.current) { setLoading(false); setRefreshing(false); } }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined;
    void load();
    const reload = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { if (active) void load(true); }, 300); };
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    const channel = userId ? supabase.channel(`agenda_mobile_${userId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, reload).subscribe() : null;
    const midnight = setInterval(() => { const next = dateKey(new Date()); setToday(previous => previous === next ? previous : next); }, 60_000);
    return () => { active = false; request.current++; if (timer) clearTimeout(timer); clearInterval(midnight); appState.remove(); if (channel) void supabase.removeChannel(channel); };
  }, [load, userId]));

  const scoped = useMemo(() => filterAgendaTasks(tasks, query, projectId), [tasks, query, projectId]);
  const filtered = useMemo(() => status === 'all' ? scoped : scoped.filter(task => task.estatus === status), [scoped, status]);
  const visible = useMemo(() => periodTasks(filtered, view, date), [filtered, view, date]);
  const rows = useMemo(() => !visible.length || (loading && !tasks.length) ? [] : agendaRows(filtered, view, date), [filtered, view, date, loading, tasks.length, visible.length]);
  const counts = useMemo(() => { const result = new Map<string, number>(); for (const task of filtered) if (task.fecha_programada) result.set(task.fecha_programada, (result.get(task.fecha_programada) || 0) + 1); return result; }, [filtered]);
  const statusCounts = useMemo(() => { const items = periodTasks(scoped, view, date); return { all: items.length, pendiente: items.filter(task => task.estatus === 'pendiente').length, en_proceso: items.filter(task => task.estatus === 'en_proceso').length, completada: items.filter(task => task.estatus === 'completada').length }; }, [scoped, view, date]);
  const undated = useMemo(() => filtered.filter(task => !task.fecha_programada).length, [filtered]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale]);
  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
  const shortFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale]);
  const openTask = useCallback((id: string) => router.push(`/task/${id}` as any), [router]);
  const rowExtra = useMemo(() => ({ c, today }), [c, today]);
  const resetScroll = () => list.current?.scrollToOffset({ offset: 0, animated: false });
  const changeDate = (next: string) => { setDate(next); resetScroll(); };
  const changeView = (next: AgendaView) => { setView(next); resetScroll(); };
  const selectProject = (project?: Project) => { setAllProjects(!project); if (project) setSelectedProject(project); resetScroll(); };
  const move = (direction: number) => changeDate(view === 'month' ? shiftMonth(date, direction) : shiftDate(date, direction * (view === 'week' ? 7 : 1)));
  const periodLabel = view === 'month' ? monthFormat.format(parseDateKey(date)) : view === 'week' ? `${shortFormat.format(parseDateKey(weekDates(date)[0]))} – ${shortFormat.format(parseDateKey(weekDates(date)[4]))}` : shortFormat.format(parseDateKey(date));

  const renderRow = useCallback(({ item }: { item: AgendaRow }) => {
    if (item.kind === 'task') return <AgendaTaskCard task={item.task} copy={c} today={today} onOpen={openTask} />;
    if (item.kind === 'empty') return <Text style={styles.emptyDay}>{c.noTasks}</Text>;
    return <View style={styles.dayHeading}><Text style={[styles.dayHeadingText, item.date === today && styles.todayHeading]}>{dateFormat.format(parseDateKey(item.date))}</Text><Text style={styles.smallCount}>{item.count}</Text></View>;
  }, [c, today, openTask, dateFormat]);

  const empty = loading ? <View style={styles.empty}><ActivityIndicator color={P.accent} /><Text style={styles.emptyHelp}>{c.loading}</Text></View> : <View style={styles.empty}>
    <CalendarDays size={28} color={P.slate} />
    <Text style={styles.emptyTitle}>{error ? c.failed : !tasks.length ? c.emptyAssigned : !scoped.length || status !== 'all' ? c.emptyFilters : view === 'unscheduled' ? c.emptyUnscheduled : view === 'week' ? c.emptyWeek : c.emptyDay}</Text>
    <Text style={styles.emptyHelp}>{error ? c.retry : !tasks.length ? c.emptyAssignedHelp : view === 'unscheduled' ? c.unscheduledHelp : c.emptyHelp}</Text>
    {error ? <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.outlineButton}><RefreshCw size={16} color={P.ink} /><Text style={styles.buttonText}>{c.retry}</Text></Pressable>
      : tasks.length && (!scoped.length || status !== 'all') ? <Pressable accessibilityRole="button" onPress={() => { setQuery(''); setStatus('all'); setAllProjects(true); }} style={styles.outlineButton}><Text style={styles.buttonText}>{c.clear}</Text></Pressable>
      : undated > 0 && view !== 'unscheduled' ? <Pressable accessibilityRole="button" onPress={() => changeView('unscheduled')} style={styles.outlineButton}><Text style={styles.buttonText}>{c.seeUnscheduled} ({undated})</Text></Pressable> : null}
  </View>;

  const header = <View>
    <View style={styles.titleRow}><Text style={styles.title}>{c.title}</Text><Text style={styles.total}>{visible.length} {visible.length === 1 ? c.task : c.tasks}</Text><Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? c.closeSearch : c.openSearch} accessibilityState={{ expanded: searchOpen }} onPress={() => { if (searchOpen) setQuery(''); setSearchOpen(!searchOpen); }} style={styles.iconButton}>{searchOpen ? <X size={21} color={P.ink} /> : <Search size={21} color={P.ink} />}</Pressable></View>
    {searchOpen ? <View style={styles.search}><Search size={17} color={P.slate} /><TextInput autoFocus accessibilityLabel={c.search} placeholder={c.search} placeholderTextColor={P.muted} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" style={styles.searchInput} /></View> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={c.views} style={styles.tabRail} contentContainerStyle={styles.viewTabs}>{views.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: view === item }} onPress={() => changeView(item)} style={[styles.viewTab, view === item && styles.selectedTab]}><Text numberOfLines={1} style={[styles.tabText, view === item && styles.selectedTabText]}>{c[item]}{item === 'unscheduled' && undated > 0 ? ` (${undated})` : ''}</Text></Pressable>)}</ScrollView>
    {view !== 'unscheduled' ? <View style={styles.period}><Pressable accessibilityRole="button" accessibilityLabel={c.previous} onPress={() => move(-1)} style={styles.iconButton}><ChevronLeft size={21} color={P.ink} /></Pressable><Text style={styles.periodTitle}>{periodLabel}</Text><Pressable accessibilityRole="button" onPress={() => changeDate(today)} style={styles.todayButton}><Text style={styles.buttonText}>{c.today}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={c.next} onPress={() => move(1)} style={styles.iconButton}><ChevronRight size={21} color={P.ink} /></Pressable></View> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel={c.statuses}>{statuses.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: status === item }} onPress={() => { setStatus(item); resetScroll(); }} style={[styles.filter, status === item && styles.activeFilter]}><Text style={[styles.filterText, status === item && styles.activeFilterText]}>{c[item]} {statusCounts[item]}</Text></Pressable>)}</ScrollView>
    {error && tasks.length ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorText}>{c.failed}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.retry} onPress={() => void load(true)} style={styles.iconButton}><RefreshCw size={18} color={P.ink} /></Pressable></View> : null}
    {view === 'month' || view === 'week' ? <><Text style={styles.workWeek}>{c.workWeek}</Text><AgendaCalendar date={date} today={today} mode={view} counts={counts} locale={locale} onSelect={next => { changeDate(next); if (view === 'week') changeView('day'); }} /></> : null}
    {view !== 'week' ? <View style={styles.listHeading}><Text style={styles.listHeadingText}>{view === 'unscheduled' ? c.unscheduled : dateFormat.format(parseDateKey(date))}</Text><Text style={styles.smallCount}>{visible.length}</Text></View> : null}
    {view === 'unscheduled' ? <Text style={styles.unscheduledHelp}>{c.unscheduledHelp}</Text> : null}
  </View>;

  return <View style={styles.container}>
    <AgendaHeader projects={projects} projectId={projectId} onSelect={selectProject} copy={c} />
    <FlashList ref={list} data={rows} renderItem={renderRow} keyExtractor={rowKey} getItemType={rowType} ListHeaderComponent={header} ListEmptyComponent={empty} extraData={rowExtra} refreshing={refreshing} onRefresh={() => void load(true)} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.white }, content: { paddingHorizontal: 16, paddingTop: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 24 }, total: { fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 13 }, iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingHorizontal: 12, gap: 8, marginBottom: 12 }, searchInput: { flex: 1, minHeight: 46, color: P.ink, fontFamily: 'Outfit_400Regular', fontSize: 14 },
  tabRail: { borderBottomWidth: 1, borderColor: P.line, marginBottom: 8 }, viewTabs: { flexGrow: 1, flexDirection: 'row' }, viewTab: { flexGrow: 1, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' }, selectedTab: { borderColor: P.accent }, tabText: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: P.slate, textAlign: 'center' }, selectedTabText: { fontFamily: 'Outfit_600SemiBold', color: P.ink },
  period: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 6 }, periodTitle: { flex: 1, color: P.ink, fontFamily: 'Outfit_500Medium', fontSize: 16 }, todayButton: { minWidth: 48, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: P.line, borderRadius: 8 }, buttonText: { fontFamily: 'Outfit_500Medium', color: P.ink, fontSize: 13 },
  filters: { gap: 8, paddingBottom: 14 }, filter: { minHeight: 44, borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }, activeFilter: { backgroundColor: P.slate, borderColor: P.slate }, filterText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 12 }, activeFilterText: { color: P.white, fontFamily: 'Outfit_500Medium' },
  workWeek: { color: P.muted, fontFamily: 'Outfit_400Regular', fontSize: 12, marginBottom: 8 }, listHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingTop: 4 }, listHeadingText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: P.ink }, smallCount: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: P.slate, minWidth: 26, textAlign: 'center' }, dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderColor: P.line }, dayHeadingText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: P.slate }, todayHeading: { color: P.ink }, emptyDay: { paddingBottom: 16, color: P.muted, fontSize: 13, fontFamily: 'Outfit_400Regular' }, unscheduledHelp: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: P.slate, marginBottom: 14 },
  empty: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 32, gap: 12 }, emptyTitle: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 16, lineHeight: 23, textAlign: 'center' }, emptyHelp: { fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 14, lineHeight: 21, textAlign: 'center' }, outlineButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: P.line, borderRadius: 8, marginTop: 4 }, error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, marginBottom: 12, borderWidth: 1, borderColor: P.line, borderRadius: 8 }, errorText: { flex: 1, color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13 },
});
