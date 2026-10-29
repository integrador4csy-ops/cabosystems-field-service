import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
function load(name, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.${name.includes('Context') ? 'tsx' : 'ts'}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => dependencies[name] ?? require(name), setTimeout, clearTimeout, console });
  return module.exports;
}
const { SessionProfileRequest } = load('sessionProfileRequest');
const { createChatRefreshQueue } = load('chatRefreshQueue');
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('20 chat groups use three HTTP queries with per-group limits, counts and empty groups', async () => {
  const requests = [];
  const groups = Array.from({ length: 20 }, (_, index) => ({
    id: `group-${index}`, creado_por: 'user', created_at: '2026-01-01',
    member_totals: [{ count: index }],
    latest_messages: index ? [{ id: `message-${index}`, created_at: `2026-01-${String(index + 1).padStart(2, '0')}` }] : [],
  }));
  const supabase = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input) => {
      const url = new URL(input);
      requests.push(url);
      const data = url.pathname.endsWith('chat_miembros') ? [{ grupo_id: 'group-1', rol: 'miembro' }]
        : url.searchParams.get('select') === 'id' ? groups.map(group => ({ id: group.id })) : groups;
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const { getMyChatGroups } = load('chatApi', { './supabase': { supabase } });
  const result = await getMyChatGroups('user');
  assert.equal(requests.length, 3);
  const query = requests.find(url => url.searchParams.has('latest_messages.limit'));
  assert.equal(query.searchParams.get('latest_messages.limit'), '1');
  assert.equal(query.searchParams.get('latest_messages.order'), 'created_at.desc,id.desc');
  assert.match(query.searchParams.get('select'), /member_totals:chat_miembros\(count\)/);
  assert.equal(result[0].id, 'group-19');
  assert.equal(result.find(group => group.id === 'group-1').mi_rol, 'miembro');
  assert.equal(result.find(group => group.id === 'group-2').miembros_count, 2);
  assert.equal(result.at(-1).ultimo_mensaje, null);
});

test('profile reads coalesce and cannot restore a signed-out or different account', async () => {
  const guard = new SessionProfileRequest();
  const old = deferred(); const current = deferred(); const published = [];
  guard.select('a');
  const first = guard.load('a', () => old.promise, value => published.push(value));
  assert.equal(guard.load('a', () => { throw Error('duplicate'); }, () => {}), first);
  guard.select('b');
  const second = guard.load('b', () => current.promise, value => published.push(value));
  current.resolve('profile-b'); await second;
  old.resolve('profile-a'); assert.equal(await first, null);
  assert.deepEqual(published, ['profile-b']);
  const late = deferred();
  const pending = guard.load('b', () => late.promise, value => published.push(value));
  guard.reset(); late.resolve('signed-out');
  assert.equal(await pending, null);
  assert.deepEqual(published, ['profile-b']);
});

test('failed profile reads can retry and an old login of the same user stays invalid', async () => {
  const guard = new SessionProfileRequest(); guard.select('a');
  await assert.rejects(guard.load('a', async () => { throw Error('offline'); }, () => {}), /offline/);
  const old = deferred();
  const pending = guard.load('a', () => old.promise, () => assert.fail('stale profile published'));
  guard.reset(); guard.select('a');
  assert.equal(await guard.load('a', async () => 'fresh', () => {}), 'fresh');
  old.resolve('stale'); assert.equal(await pending, null);
});

test('auth provider handles events synchronously, deduplicates reads and never restores a logged-out profile', async () => {
  const state = []; const effects = []; let index = 0; let authEvent; let reads = 0;
  const profile = deferred(); const initialSession = deferred();
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (_type, props) => props,
    useState: initial => { const key = index++; state[key] = initial; return [initial, value => { state[key] = typeof value === 'function' ? value(state[key]) : value; }]; },
    useRef: current => ({ current }), useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
  };
  const supabase = {
    auth: {
      getSession: () => initialSession.promise,
      onAuthStateChange: callback => { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => { reads++; return profile.promise; } }) }) }),
  };
  const { AdminAuthProvider } = load('../context/AdminAuthContext', {
    react, '../lib/supabase': { supabase }, '../lib/sessionProfileRequest': { SessionProfileRequest },
  });
  AdminAuthProvider({ children: null });
  const cleanup = effects[0]();
  assert.equal(authEvent('SIGNED_IN', { user: { id: 'a' } }), undefined);
  await tick();
  authEvent('TOKEN_REFRESHED', { user: { id: 'a' } });
  await tick(); assert.equal(reads, 1);
  authEvent('SIGNED_OUT', null);
  profile.resolve({ data: { id: 'a', rol: 'admin', activo: true }, error: null });
  initialSession.resolve({ data: { session: { user: { id: 'a' } } } });
  await tick();
  assert.equal(state[0], null); assert.equal(state[1], null); assert.equal(state[2], false);
  cleanup();
});

test('reaction bursts deduplicate IDs and reads remain serialized across slow responses', async () => {
  const first = deferred(); const batches = [];
  const queue = createChatRefreshQueue(async ids => {
    batches.push([...ids]); if (batches.length === 1) await first.promise;
  }, 1);
  const a = queue.request('one'); const b = queue.request('one');
  await tick(); assert.equal(batches.length, 1); assert.equal(batches[0].length, 1);
  const c = queue.request('one'); const d = queue.request('two');
  await tick(); assert.equal(batches.length, 1);
  first.resolve(); await Promise.all([a, b, c, d]);
  assert.equal(batches.length, 2); assert.equal(batches[1].join(','), 'one,two');
  queue.stop();
});

test('unmount cancels queued reads and failures do not block the next batch', async () => {
  let calls = 0;
  const queue = createChatRefreshQueue(async () => { calls++; throw Error('offline'); }, 1);
  await assert.rejects(queue.request('one'), /offline/);
  const cancelled = queue.request('two'); queue.stop(); await cancelled;
  await tick(); assert.equal(calls, 1);
});
