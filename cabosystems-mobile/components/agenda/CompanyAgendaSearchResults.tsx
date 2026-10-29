import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { AgendaPalette as P } from '@/constants/Theme';
import type { AgendaSearchClient } from '@/lib/agendaSearchClient';
import { sortAgendaSearch, type AgendaSearchResponse, type AgendaSearchHit } from '@/lib/agendaSearch';
import { parseDateKey } from '@/lib/agenda';
import { eventSchedule } from '@/lib/companyAgendaPresentation';
import { CompanyAgendaEvent } from './CompanyAgendaEvent';
import type { CompanyRow } from '@/lib/companyAgenda';
import type { CompanyEvent } from '@/types/companyAgenda';

// FlashList's default item anchoring can scroll past the calendar when a new
// period or a delayed refresh replaces the rows beneath its changing header.
const CALENDAR_SCROLL_POSITION = { disabled: true };

type ResultsProps = {
  preview?: boolean;
  colors?: Record<string, string>; periodKey?: string; client: AgendaSearchClient;
  query: string; today: string; locale: string; hiddenCalendars: string[]; revision: number; header: React.ReactElement; bottomInset: number;
  fallback: { rows: CompanyRow[]; renderItem: (info: { item: CompanyRow }) => React.ReactElement; empty: React.ReactElement; refreshing: boolean; onRefresh: () => void };
  onOpen: (event: CompanyEvent) => void; onDate: (day: string) => void; onClear: () => void;
};

export function CompanyAgendaSearchResults(props: ResultsProps) {
  // Adjacent pages cannot be interacted with. A bounded snapshot avoids mounting
  // six independent list engines whenever month/week/day changes.
  if (props.preview) return <View style={s.preview}><View style={s.previewContent}>{props.header}{props.fallback.rows.length ? props.fallback.rows.slice(0, 24).map(item => <React.Fragment key={item.kind === 'heading' ? `heading-${item.date}` : `${item.event.id}-${item.event.occurrence_date || item.event.fecha}`}>{props.fallback.renderItem({ item })}</React.Fragment>) : props.fallback.empty}</View></View>;
  return <AgendaResultsList {...props} />;
}

function AgendaResultsList({ colors = {}, periodKey, client, query, today, locale, hiddenCalendars, revision, header, bottomInset, onOpen, onDate, onClear, fallback }: ResultsProps) {
  const en = locale.startsWith('en');
  const list = useRef<FlashListRef<AgendaSearchHit | CompanyRow>>(null);
  useLayoutEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [periodKey]);
  const [snapshot, setSnapshot] = useState<{ query: string; data?: AgendaSearchResponse; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    void client.search(query, today, controller.signal, data => { if (!controller.signal.aborted) setSnapshot({ query, data }); })
      .then(data => { if (!controller.signal.aborted) setSnapshot({ query, data }); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot(current => ({ query, data: current?.query === query ? current.data : undefined, failed: true })); });
    return () => controller.abort();
  }, [client, query, today, retry, revision]);
  const current = snapshot?.query === query ? snapshot : null;
  const hits = useMemo(() => sortAgendaSearch((current?.data?.hits || []).filter(hit => !hiddenCalendars.includes(hit.event.google?.calendarId || 'local')), today, query), [current, hiddenCalendars, today, query]);
  const [dateWindow, setDateWindow] = useState(50);
  const onVisible = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const end = Math.max(50, ...viewableItems.map(item => (item.index || 0) + 20));
    setDateWindow(current => Math.max(current, end));
  }, []);
  const visible = useRef(hits);
  useEffect(() => { visible.current = hits; }, [hits]);
  const pendingIds = hits.slice(0, dateWindow).filter(hit => hit.nextDatePending).map(hit => hit.event.id).join('|');
  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    const ids = new Set(pendingIds.split('|'));
    void client.completeDates(visible.current.filter(hit => ids.has(hit.event.id)), today, controller.signal).then(dates => {
      if (controller.signal.aborted) return;
      const byId = new Map(dates.map(date => [date.id, date.nextDate]));
      setSnapshot(current => current?.query !== query || !current.data ? current : { ...current, data: { ...current.data, hits: current.data.hits.map(hit => ids.has(hit.event.id) ? { ...hit, nextDate: byId.get(hit.event.id) ?? null, nextDatePending: false, nextDateUnavailable: !byId.has(hit.event.id) } : hit) } });
    }).catch(() => {
      if (!controller.signal.aborted) setSnapshot(current => current?.query !== query || !current.data ? current : { ...current, data: { ...current.data, hits: current.data.hits.map(hit => ids.has(hit.event.id) ? { ...hit, nextDatePending: false, nextDateUnavailable: true } : hit) } });
    });
    return () => controller.abort();
  }, [client, pendingIds, query, today]);
  const format = (day: string) => parseDateKey(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const renderItem = ({ item }: { item: AgendaSearchHit }) => {
    const day = item.nextDate || item.event.occurrence_date || item.event.fecha;
    return <View style={s.result}>
      <Text style={s.date}>{item.nextDatePending || item.nextDateUnavailable ? (en ? 'Series start: ' : 'Inicio de serie: ') : ''}{format(day)}</Text>
      {item.series ? <Text style={s.help}>{item.nextDatePending ? (en ? 'Finding next date…' : 'Consultando próxima fecha…') : item.nextDateUnavailable ? (en ? 'Next date unavailable' : 'Próxima fecha no disponible') : item.nextDate ? (en ? 'Series · next occurrence' : 'Serie · próxima fecha') : (en ? 'Series · start date' : 'Serie · fecha inicial')}</Text> : null}
      <Text style={s.help}>{item.event.google?.calendarName || 'CaboSystems'}</Text>
      <CompanyAgendaEvent color={colors[item.event.google?.calendarId || 'local']} event={item.event} time={item.event.hora?.slice(0, 5) || (en ? 'All day' : 'Todo el día')} schedule={eventSchedule(item.event, locale)} type={en ? 'Event' : 'Evento'} repeats={en ? 'Repeats' : 'Se repite'} onOpen={onOpen} />
      <Pressable accessibilityRole="button" disabled={item.nextDatePending} accessibilityState={{ disabled: Boolean(item.nextDatePending) }} accessibilityLabel={`${en ? 'View date' : 'Ver fecha'}: ${format(day)}`} onPress={() => onDate(day)} style={s.button}><Text style={s.buttonText}>{en ? 'View date' : 'Ver fecha'}</Text></Pressable>
    </View>;
  };
  const searching = Boolean(query);
  const data: (AgendaSearchHit | CompanyRow)[] = searching ? hits : fallback.rows;
  return <FlashList ref={list} maintainVisibleContentPosition={CALENDAR_SCROLL_POSITION} onViewableItemsChanged={onVisible} data={data} keyExtractor={item => 'series' in item ? item.event.id : item.kind === 'heading' ? `heading-${item.date}` : `${item.event.id}-${item.event.occurrence_date || item.event.fecha}`} getItemType={item => 'series' in item ? 'search' : item.kind} renderItem={({ item }) => 'series' in item ? renderItem({ item }) : fallback.renderItem({ item })} refreshing={searching ? false : fallback.refreshing} onRefresh={searching ? () => setRetry(value => value + 1) : fallback.onRefresh} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 110 }} ListHeaderComponent={<View>{header}{searching ? <View style={s.heading}><Text accessibilityRole="header" style={s.title}>{en ? 'Search all dates' : 'Buscar en todas las fechas'}</Text><Text accessibilityRole="text" accessibilityLiveRegion="polite" style={s.help}>{!current ? (en ? 'Searching…' : 'Buscando…') : current.failed ? (en ? 'Search incomplete. Visible results may be partial.' : 'Búsqueda incompleta. Pueden faltar resultados.') : `${hits.length} ${en ? (hits.length === 1 ? 'result' : 'results') : (hits.length === 1 ? 'coincidencia' : 'coincidencias')}${current.data?.pending ? (en ? ' · completing…' : ' · completando…') : ''}`}</Text><Pressable accessibilityRole="button" onPress={onClear} style={s.button}><Text style={s.buttonText}>{en ? 'Back to calendar' : 'Volver al calendario'}</Text></Pressable>{current?.data?.unavailableCalendars ? <Text style={s.help}>{en ? 'Availability-only calendars cannot be searched by text.' : 'Los calendarios que solo comparten disponibilidad no permiten buscar por texto.'}</Text> : null}</View> : null}</View>} ListEmptyComponent={!searching ? fallback.empty : !current || current.data?.pending && !current.failed ? <ActivityIndicator style={s.empty} color={P.accent} /> : current.failed ? <View accessibilityRole="alert" style={s.empty}><Text style={s.help}>{en ? 'Check your connection. The visible results are incomplete.' : 'Comprueba tu conexión. Los resultados visibles están incompletos.'}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={s.button}><Text style={s.buttonText}>{en ? 'Try again' : 'Reintentar'}</Text></Pressable></View> : <Text style={[s.help, s.empty]}>{en ? 'No matches across all dates.' : 'No hay coincidencias en ninguna fecha.'}</Text>} />;
}
const s = StyleSheet.create({
  preview: { flex: 1, overflow: 'hidden' },
  previewContent: { paddingHorizontal: 20 },
  heading: { paddingTop: 20, paddingBottom: 12, gap: 8 },
  title: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 18 },
  help: { fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 13, lineHeight: 20 },
  date: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 14, lineHeight: 21 },
  result: { paddingTop: 20, paddingBottom: 12, gap: 4, borderBottomWidth: 1, borderColor: P.line },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, borderWidth: 1, borderColor: P.line, borderRadius: 8, marginTop: 8 },
  buttonText: { fontFamily: 'Outfit_500Medium', color: P.ink, fontSize: 14 },
  empty: { paddingVertical: 24, gap: 12 },
});
