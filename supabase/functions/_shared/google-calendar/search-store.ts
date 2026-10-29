import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import type { GoogleSearchIndex } from './search-index.ts';

export function createSearchIndexStore(db: SupabaseClient): GoogleSearchIndex {
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error('Cannot update Calendar search index');
    return data;
  }
  return {
    async authorizedCalendars(revision, calendars) {
      const { data, error } = await db.from('agenda_google_search_state').select('calendar_id,calendar_name,access_role,synced_at,sync_token')
        .eq('revision', revision).in('calendar_id', calendars.map(calendar => calendar.id));
      if (error) throw new Error('Cannot read search authorization');
      const states = new Map((data || []).map(row => [row.calendar_id, row]));
      const result = [];
      for (const calendar of calendars) {
        const state = states.get(calendar.id);
        // This is also the maximum lifetime of a cached Google permission check.
        if (!state?.sync_token || !state.synced_at || !Number.isFinite(Date.parse(state.synced_at)) || Date.parse(state.synced_at) <= Date.now() - 30_000) return null;
        if (!['owner','writer','reader','writerWithoutPrivateAccess','freeBusyReader'].includes(state.access_role)) return null;
        result.push({ ...calendar, accessRole: state.access_role, name: state.calendar_name });
      }
      return result;
    },
    async lookup(revision, calendar, ids) {
      const { data, error } = await db.from('agenda_google_search_documents').select('payload').eq('revision', revision).eq('calendar_id', calendar).in('event_id', ids);
      if (error) throw new Error('Cannot read indexed series');
      return (data || []).map(row => row.payload);
    },
    claim: (revision, calendar) => rpc('agenda_search_claim', { p_revision: revision, p_calendar: calendar.id, p_role: calendar.accessRole, p_name: calendar.name }),
    async commit(revision, calendar, lease, token, full, items) {
      await rpc('agenda_search_commit', { p_revision: revision, p_calendar: calendar.id, p_lease: lease, p_role: calendar.accessRole, p_name: calendar.name, p_token: token, p_full: full, p_items: items });
    },
    async release(revision, calendar, lease) { await rpc('agenda_search_release', { p_revision: revision, p_calendar: calendar, p_lease: lease }); },
    async invalidate(revision, calendar) { await rpc('agenda_search_invalidate', { p_revision: revision, p_calendar: calendar }); },
    async search(revision, calendars, query) {
      const result = [];
      for (let offset = 0; ; offset += 500) {
        const rows = await rpc('agenda_search_google', { p_revision: revision, p_calendars: calendars.map(({ id, name, accessRole }) => ({ id, name, accessRole })), p_query: query, p_offset: offset, p_limit: 500 });
        if (!Array.isArray(rows)) throw new Error('Invalid Calendar search index response');
        result.push(...rows);
        if (result.length > 20000) throw new Error('Too many Calendar search matches');
        if (rows.length < 500) break;
      }
      return result;
    },
  };
}
