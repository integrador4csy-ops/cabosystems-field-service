const test = require('node:test');
const assert = require('node:assert/strict');
const { load, group, message } = require('./chat-test-helpers.cjs');

function fixture({ size = 1005, failMembership = false } = {}) {
  const calls = [];
  const memberships = Array.from({ length: size }, (_, i) => ({ grupo_id: `room-${i}`, rol: 'miembro' }));
  const groups = memberships.map((row, i) => ({ ...group(row.grupo_id), creado_por: 'someone-else', created_at: new Date(2026, 0, 1, 0, 0, i).toISOString() }));
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) },
    from(table) {
      const query = { table, filters: {}, orders: [] }; calls.push(query);
      const chain = {
        select(columns, options) { query.columns = columns; query.options = options; return chain; },
        eq(key, value) { query.filters[key] = value; return chain; },
        in(key, value) { query.ids = value; return chain; },
        order(key, options) { query.orders.push([key, options]); return chain; },
        range(start, end) { query.range = [start, end]; return chain; },
        limit(value) { query.limit = value; return chain; },
        or(value) { query.or = value; return chain; },
        maybeSingle() { query.single = true; return chain; },
        then(resolve, reject) {
          let result = { data: [], error: null };
          if (table === 'chat_miembros') {
            if (query.options?.head) result = { data: null, count: 2, error: null };
            else if (failMembership) result = { data: null, error: Error('network failed') };
            else result.data = memberships.slice(query.range?.[0] ?? 0, (query.range?.[1] ?? 999) + 1);
          } else if (table === 'chat_grupos') result.data = query.ids ? groups.filter(row => query.ids.includes(row.id)) : [];
          else if (table === 'chat_mensajes') result.data = query.single ? null : [message(2), message(1)];
          return Promise.resolve(result).then(resolve, reject);
        },
      }; return chain;
    },
  };
  return { api: load('chatApi.ts', { './supabase': { supabase } }), calls };
}

test('group enumeration includes more than 1000 memberships and bounds enrichment requests', async () => {
  const { api, calls } = fixture(); const groups = await api.getMyChatGroups('u');
  assert.equal(groups.length, 1005);
  assert.equal(new Set(groups.map(row => row.id)).size, 1005);
  assert.deepEqual(calls.filter(call => call.table === 'chat_miembros' && !call.options?.head).map(call => call.range), [[0, 499], [500, 999], [1000, 1499]]);
  assert.ok(calls.filter(call => call.table === 'chat_grupos' && call.ids).every(call => call.ids.length <= 200));
});

test('failed membership queries are errors, never authoritative empty group lists', async () => {
  const { api } = fixture({ failMembership: true });
  await assert.rejects(api.getMyChatGroups('u'), /network failed/);
});

test('remote message pages have stable timestamp and ID ordering and a compound cursor', async () => {
  const { api, calls } = fixture(); const before = message(50);
  await api.getGroupMessagePage('room', before);
  const query = calls.find(call => call.table === 'chat_mensajes');
  assert.equal(query.filters.grupo_id, 'room');
  assert.equal(query.limit, 100);
  assert.deepEqual(query.orders.map(row => row[0]), ['created_at', 'id']);
  assert.ok(query.or.includes(`created_at.lt.${before.created_at}`));
  assert.ok(query.or.includes(`id.lt.${before.id}`));
});
