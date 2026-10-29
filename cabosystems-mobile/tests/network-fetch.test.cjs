const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(fetch) {
  let timeout; let cleared = false;
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/networkFetch.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, AbortController, Request, fetch,
    setTimeout(callback, duration) { assert.equal(duration, 60000); timeout = callback; return 1; },
    clearTimeout() { cleared = true; },
  });
  return { fetch: module.exports.networkFetch, timeout: () => timeout(), cleared: () => cleared };
}
test('successful requests preserve upload body and headers and clear the timeout', async () => {
  const body = new Uint8Array([1, 2]);
  const client = setup(async (url, options) => { assert.equal(url, 'https://test.invalid'); assert.equal(options.body, body); assert.equal(options.headers.authorization, 'test'); return { ok: true }; });
  assert.equal((await client.fetch('https://test.invalid', { method: 'POST', body, headers: { authorization: 'test' } })).ok, true);
  assert.equal(client.cleared(), true);
});
test('caller cancellation and stalled-request timeouts abort the real fetch', async () => {
  const client = setup((_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })));
  const controller = new AbortController();
  const first = client.fetch('https://test.invalid', { signal: controller.signal }); controller.abort();
  await assert.rejects(first, /aborted/); assert.equal(client.cleared(), true);
  const second = client.fetch('https://test.invalid'); client.timeout(); await assert.rejects(second, /aborted/);
});
