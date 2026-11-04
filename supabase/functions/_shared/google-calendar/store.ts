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
    async connection(userId) {
      const existing = await db.from('google_calendar_connection').select('*').eq('user_id', userId).maybeSingle();
      if (existing.error) throw new Error('Cannot read Calendar connection');
      if (existing.data) return existing.data as Connection;
      const created = await db.from('google_calendar_connection').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }).select('*').maybeSingle();
      if (created.error) throw new Error('Cannot create Calendar connection');
      if (created.data) return created.data as Connection;
      const concurrent = await db.from('google_calendar_connection').select('*').eq('user_id', userId).single();
      if (concurrent.error || !concurrent.data) throw new Error('Cannot read Calendar connection');
      return concurrent.data as Connection;
    },
    async createState(hash, state, expires) {
      const { error: cleanup } = await db.from('google_calendar_oauth_states').delete().or(`expires_at.lt.${new Date().toISOString()},user_id.eq.${state.user_id}`);
      if (cleanup) throw new Error('Cannot clean OAuth states');
      const { error } = await db.from('google_calendar_oauth_states').insert({ state_hash: hash, ...state, expires_at: expires });
      if (error) throw new Error('Cannot create OAuth state');
    },
    async consumeState(hash, now) {
      const { data, error } = await db.from('google_calendar_oauth_states').delete().eq('state_hash', hash).gt('expires_at', now).select('user_id,base_revision,verifier_ciphertext').maybeSingle();
      if (error) throw new Error('Cannot consume OAuth state');
      return data as OAuthState | null;
    },
    async commitConnection(revision, patch, userId) {
      const { data, error } = await db.from('google_calendar_connection').update({ ...patch, revision: crypto.randomUUID(), updated_at: new Date().toISOString() }).eq('user_id', userId).eq('revision', revision).select('user_id').maybeSingle();
      if (error) throw new Error('Cannot save Calendar connection');
      return Boolean(data);
    },
  };
}
