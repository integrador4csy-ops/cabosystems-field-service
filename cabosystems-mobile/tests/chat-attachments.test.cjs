const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function apiFixture(web = false, failUpload = false, failPoster = false) {
  const calls = [];
  const supabase = {
    storage: { from: () => ({
      upload: async (key, bytes, options) => { calls.push({ key, bytes, options }); return { data: { path: key }, error: failUpload ? Error('upload failed') : null }; },
      getPublicUrl: key => ({ data: { publicUrl: `https://files.test/${key}` } }),
    }) },
    from: () => ({ insert: payload => { calls.push({ payload }); return { select: () => ({ single: async () => ({ data: { id: 'sent', ...payload }, error: null }) }) }; } }),
    functions: { invoke: async () => ({}) },
  };
  const filename = path.join(__dirname, web ? '../../cabosystems-web/src/lib/chatApi.ts' : '../lib/chatApi.ts');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => { if (name === './supabase') return { supabase }; if (name === './chatVideoPoster') return { createChatVideoPoster: async () => { if (failPoster) throw Error('poster failed'); return 'https://cache.test/poster.jpg'; } }; throw Error(name); },
    fetch: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
    File, Blob, Date, Math, console,
  });
  return { api: exports, calls };
}

for (const web of [false, true]) {
  test(`${web ? 'web' : 'mobile'} sends documents and audio with MIME, filename, size and duration`, async () => {
    for (const [tipo, name, mime] of [['archivo', 'informe.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['archivo', 'tabla.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['archivo', 'plano.pdf', 'application/pdf'], ['audio', 'nota.m4a', 'audio/mp4']]) {
      const { api, calls } = apiFixture(web);
      const mediaMeta = { fileName: name, mimeType: mime, fileSize: 3, duration: tipo === 'audio' ? 2 : undefined };
      const sent = await api.sendChatMessage({ grupo_id: 'g', remitente_id: 'u', tipo, mediaMeta,
        ...(web ? { mediaFile: new File(['abc'], name, { type: mime }) } : { mediaUri: `https://cache.test/${name}` }) });
      assert.ok(sent.media_url.endsWith(name.split('.').at(-1)));
      assert.equal(calls[0].options.contentType, mime);
      assert.equal(calls[1].payload.tipo, tipo);
      assert.equal(calls[1].payload.media_meta.fileName, name);
      assert.equal(calls[1].payload.media_meta.fileSize, 3);
      if (!web) assert.equal(calls[0].bytes.byteLength, 3);
    }
  });
  test(`${web ? 'web' : 'mobile'} never inserts a message when its upload fails`, async () => {
    const { api, calls } = apiFixture(web, true);
    await assert.rejects(api.sendChatMessage({ grupo_id: 'g', remitente_id: 'u', tipo: 'archivo',
      ...(web ? { mediaFile: new File(['abc'], 'test.pdf') } : { mediaUri: 'https://cache.test/test.pdf' }) }), /upload failed/);
    assert.equal(calls.some(call => call.payload), false);
  });
}

test('mobile uploads a small poster and persists its URL alongside the video', async () => {
 const {api, calls} = apiFixture();
 const sent = await api.sendChatMessage({grupo_id:'g',remitente_id:'u',tipo:'video',mediaUri:'https://cache.test/clip.mp4'});
 assert.ok(sent.media_url.endsWith('.mp4'));
 assert.ok(sent.media_thumbnail_url.endsWith('.jpg'));
 assert.deepEqual(calls.filter(call=>call.options).map(call=>call.options.contentType), ['video/mp4','image/jpeg']);
});
test('poster failure does not prevent sending a playable video', async () => {
 const {api} = apiFixture(false, false, true);
 const sent = await api.sendChatMessage({grupo_id:'g',remitente_id:'u',tipo:'video',mediaUri:'https://cache.test/clip.mp4'});
 assert.ok(sent.media_url.endsWith('.mp4'));
 assert.equal(sent.media_thumbnail_url, undefined);
});
