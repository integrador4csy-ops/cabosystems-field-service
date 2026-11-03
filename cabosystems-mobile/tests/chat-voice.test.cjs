const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture({ delayed = false, denied = false } = {}) {
  let hook, renderer, finishPermission, stopped = 0, errors = 0, time = 0;
  const drafts = [];
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const navigator = { mediaDevices: { getUserMedia: () => denied ? Promise.reject(Error('denied')) : delayed ? new Promise(resolve => { finishPermission = () => resolve(stream); }) : Promise.resolve(stream) } };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.mimeType = 'audio/webm'; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['voice'], { type: this.mimeType }) }); this.onstop(); }
  }
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../../cabosystems-web/src/lib/useVoiceNote.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: () => React, navigator, MediaRecorder: Recorder, File, Blob,
    Date: { now: () => time }, document: { addEventListener() {}, removeEventListener() {} },
    window: { setInterval: () => 1, clearInterval() {} },
  });
  function Probe() { hook = exports.useVoiceNote((file, duration) => drafts.push({ file, duration }), () => errors++); return null; }
  await React.act(async () => { renderer = Renderer.create(React.createElement(Probe)); });
  return { get hook() { return hook; }, drafts, get stopped() { return stopped; }, get errors() { return errors; },
    time: value => { time = value; }, grant: () => finishPermission(), close: () => React.act(async () => renderer.unmount()) };
}

test('voice recording produces a playable draft and releases the microphone', async () => {
  const api = await fixture();
  try {
    await React.act(async () => api.hook.start()); assert.equal(api.hook.recording, true);
    api.time(2500); await React.act(async () => api.hook.stop());
    assert.equal(api.hook.recording, false); assert.equal(api.stopped, 1);
    assert.equal(api.drafts.length, 1); assert.equal(api.drafts[0].file.type, 'audio/webm'); assert.equal(api.drafts[0].duration, 2.5);
  } finally { await api.close(); }
});
test('cancel discards recordings and permission granted after cancel never starts the microphone', async () => {
  const api = await fixture({ delayed: true });
  try {
    let pending;
    await React.act(async () => { pending = api.hook.start(); });
    await React.act(async () => api.hook.cancel());
    await React.act(async () => { api.grant(); await pending; });
    assert.equal(api.hook.recording, false); assert.equal(api.stopped, 1); assert.equal(api.drafts.length, 0);
  } finally { await api.close(); }
  const active = await fixture();
  await React.act(async () => active.hook.start()); active.time(2000);
  await React.act(async () => active.hook.cancel()); assert.equal(active.drafts.length, 0); assert.equal(active.stopped, 1);
  await active.close();
});
test('microphone denial shows a recoverable error and unmount releases active capture', async () => {
  const denied = await fixture({ denied: true });
  await React.act(async () => denied.hook.start());
  assert.equal(denied.errors, 1); assert.equal(denied.hook.starting, false); await denied.close();
  const active = await fixture(); await React.act(async () => active.hook.start());
  await active.close(); assert.equal(active.stopped, 1); assert.equal(active.drafts.length, 0);
});
