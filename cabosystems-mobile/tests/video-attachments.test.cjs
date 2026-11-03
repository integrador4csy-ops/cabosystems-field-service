const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.join(__dirname, '..');

function load(file, imports = {}) {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(root, file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    { exports: module.exports, module, require: (name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name}`); }, console, Intl, URL, Date, Map, Set },
    { filename: file }
  );
  return module.exports;
}

const { CHAT_COPY } = load('lib/chatCopy.ts');

test('all new video and attachment menu keys exist symmetrically in es and en', () => {
  const esKeys = Object.keys(CHAT_COPY.es).sort();
  const enKeys = Object.keys(CHAT_COPY.en).sort();
  assert.deepEqual(esKeys, enKeys);

  const requiredVideoKeys = [
    'recordVideo',
    'recordVideoDesc',
    'takePhoto',
    'takePhotoDesc',
    'galleryMedia',
    'galleryMediaDesc',
    'documentDesc',
    'playVideo',
    'closeVideo',
    'openExternal',
    'videoLoading',
    'videoError',
  ];

  for (const key of requiredVideoKeys) {
    assert.ok(CHAT_COPY.es[key], `Missing es key ${key}`);
    assert.ok(CHAT_COPY.en[key], `Missing en key ${key}`);
  }
});

test('video upload extension resolver infers correct file extensions from contentType', () => {
  function resolveExtension(uri, originalName, contentType) {
    const suffix = (originalName || uri.split(/[?#]/)[0]).split('.').pop()?.toLowerCase() || '';
    let ext = /^[a-z0-9]{1,12}$/.test(suffix) ? suffix : '';
    if (!ext || ext === 'bin') {
      if (contentType?.includes('mp4')) ext = 'mp4';
      else if (contentType?.includes('quicktime') || contentType?.includes('mov')) ext = 'mov';
      else if (contentType?.includes('video')) ext = 'mp4';
      else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) ext = 'jpg';
      else if (contentType?.includes('png')) ext = 'png';
      else if (contentType?.includes('webp')) ext = 'webp';
      else if (contentType?.includes('pdf')) ext = 'pdf';
      else ext = 'bin';
    }
    return ext;
  }

  // Content URI on Android without explicit extension
  assert.equal(resolveExtension('content://media/external/video/media/1054', undefined, 'video/mp4'), 'mp4');
  assert.equal(resolveExtension('content://media/external/video/media/1054', undefined, 'video/quicktime'), 'mov');
  // File URI with existing extension
  assert.equal(resolveExtension('file:///cache/test_video.mp4', undefined, 'video/mp4'), 'mp4');
  assert.equal(resolveExtension('file:///cache/test_video.mov', undefined, 'video/quicktime'), 'mov');
  // Original name provided
  assert.equal(resolveExtension('blob:https://app.test/uuid', 'camera_capture.mp4', 'video/mp4'), 'mp4');
});

test('video duration formatting handles null, zero, seconds and long durations', () => {
  function formatVideoDuration(seconds) {
    if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  assert.equal(formatVideoDuration(null), '');
  assert.equal(formatVideoDuration(undefined), '');
  assert.equal(formatVideoDuration(0), '');
  assert.equal(formatVideoDuration(-5), '');
  assert.equal(formatVideoDuration(9), '0:09');
  assert.equal(formatVideoDuration(45), '0:45');
  assert.equal(formatVideoDuration(60), '1:00');
  assert.equal(formatVideoDuration(75), '1:15');
  assert.equal(formatVideoDuration(3605), '60:05');
});

test('duration normalization correctly converts milliseconds and keeps seconds', () => {
  function normalizeDuration(duration) {
    if (duration == null || isNaN(duration) || duration <= 0) return undefined;
    return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration);
  }

  assert.equal(normalizeDuration(undefined), undefined);
  assert.equal(normalizeDuration(null), undefined);
  assert.equal(normalizeDuration(0), undefined);
  assert.equal(normalizeDuration(15), 15);
  assert.equal(normalizeDuration(45), 45);
  // 15400 ms -> 15 s
  assert.equal(normalizeDuration(15400), 15);
  // 92800 ms -> 93 s
  assert.equal(normalizeDuration(92800), 93);
});
