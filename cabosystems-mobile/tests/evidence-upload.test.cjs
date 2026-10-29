const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(uploadError, infoError = null) {
  let options; let inspected = 0;
  const storage = {
    upload: async (_, body, value) => { assert.equal(body.byteLength, 3); options = value; return { error: uploadError }; },
    info: async path => { assert.equal(path, 'fixed.jpg'); inspected++; return { data: infoError ? null : { size: 3 }, error: infoError }; },
    getPublicUrl: () => ({ data: { publicUrl: 'https://test.invalid/fixed.jpg' } }),
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, console, Uint8Array,
    require: () => ({ supabase: { storage: { from: bucket => { assert.equal(bucket, 'evidencias-campo'); return storage; } } } }),
    fetch: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
  });
  return { upload: () => module.exports.uploadEvidencePhoto('file:///photo.jpg', 'fixed.jpg', true), options: () => options, inspected: () => inspected };
}
test('pending evidence uploads require INSERT rather than overwrite permission', async () => {
  const api = setup(null); assert.equal(await api.upload(), 'https://test.invalid/fixed.jpg');
  assert.equal(api.options().upsert, false); assert.equal(api.inspected(), 0);
});
test('an already uploaded image is confirmed and reused after a lost response', async () => {
  const api = setup({ statusCode: '409', message: 'The resource already exists' });
  assert.equal(await api.upload(), 'https://test.invalid/fixed.jpg'); assert.equal(api.inspected(), 1);
});
test('permission errors and unconfirmed duplicates are never reported as success', async () => {
  const denied = { statusCode: '403', message: 'Access denied' };
  const api = setup(denied); await assert.rejects(api.upload, error => error === denied); assert.equal(api.inspected(), 0);
  const inaccessible = setup({ statusCode: '409', message: 'Duplicate' }, denied);
  await assert.rejects(inaccessible.upload, error => error === denied);
});
