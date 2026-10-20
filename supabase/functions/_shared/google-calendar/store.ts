import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import type { Connection, OAuthState, Store } from './core.ts';

export function createStore(db: SupabaseClient): Store {
  async function actorById(id: string) {
    const { data, error } = await db.from('profiles').select('id,rol,activo').eq('id', id).maybeSingle();
    if (error) throw new Error('Cannot read canonical profile');
    return data;
  }
  return {
    actorById,
    async actorForToken(token) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return null;
      return actorById(data.user.id);
    },
    async connection() {
      const { data, error } = await db.from('google_calendar_connection').select('*').eq('id', true).single();
      if (error || !data) throw new Error('Cannot read Calendar connection');
      return data as Connection;
    },
    async createState(hash, state, expires) {
      const { error: cleanup } = await db.from('google_calendar_oauth_states').delete().or(`expires_at.lt.${new Date().toISOString()},admin_id.eq.${state.admin_id}`);
      if (cleanup) throw new Error('Cannot clean OAuth states');
      const { error } = await db.from('google_calendar_oauth_states').insert({ state_hash: hash, ...state, expires_at: expires });
      if (error) throw new Error('Cannot create OAuth state');
    },
    async consumeState(hash, now) {
      const { data, error } = await db.from('google_calendar_oauth_states').delete().eq('state_hash', hash).gt('expires_at', now).select('admin_id,base_revision,verifier_ciphertext').maybeSingle();
      if (error) throw new Error('Cannot consume OAuth state');
      return data as OAuthState | null;
    },
    async commitConnection(revision, patch) {
      const { data, error } = await db.from('google_calendar_connection').update({ ...patch, revision: crypto.randomUUID(), updated_at: new Date().toISOString() }).eq('id', true).eq('revision', revision).select('id').maybeSingle();
      if (error) throw new Error('Cannot save Calendar connection');
      return Boolean(data);
    },
  };
}
