const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => name in imports ? imports[name] : require(name), console, Object, Set });
  return exports;
}
function fixture(saved = null, delayed = false) {
  const copy = load('uiTranslations.ts');
  const localization = load('localization.ts', { './uiTranslations': copy });
  let finishRead;
  const writes = [];
  const storage = {
    getItemAsync: () => delayed ? new Promise(resolve => { finishRead = resolve; }) : Promise.resolve(saved),
    setItemAsync: async (_, value) => { writes.push(value); },
  };
  const i18n = load('i18n.tsx', { './localization': localization, 'react-native': { Platform: { OS: 'android' } }, 'expo-secure-store': storage });
  return { ...i18n, ...localization, ...copy, writes, finishRead: value => finishRead(value) };
}
async function mounted(f, run) {
  let state, renderer;
  function Probe() { state = f.useTranslation(); return React.createElement('label', null, state.t('nav.tasks')); }
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(f.LanguageProvider, null, React.createElement(Probe))); });
    await run(() => state, renderer);
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
}

test('English is the default for fresh installations and invalid preferences', async () => {
  for (const saved of [null, 'fr', '']) {
    const f = fixture(saved);
    await mounted(f, state => {
      assert.equal(state().language, 'en');
      assert.equal(state().isEnglish, true);
      assert.equal(state().t('nav.tasks'), 'Tasks');
      assert.equal(state().t('Iniciar Sesión'), 'Sign in');
      assert.equal(f.getLocale(), 'en-US');
    });
  }
});

test('explicit Spanish preferences restore and both interfaces switch live', async () => {
  const f = fixture('es');
  await mounted(f, async state => {
    assert.equal(state().language, 'es');
    assert.equal(state().t('nav.tasks'), 'Tareas');
    assert.equal(state().t('Guardar Cambios'), 'Guardar Cambios');
    await React.act(async () => { await state().setLanguage('en'); });
    assert.equal(state().t('Guardar Cambios'), 'Save changes');
    assert.equal(state().t('Modo Solo Multimedia'), 'Media-only mode');
    assert.equal(f.translateCurrent('Permiso requerido'), 'Permission required');
    await React.act(async () => { await state().setLanguage('es'); });
    assert.equal(state().t('Modo Solo Multimedia'), 'Modo Solo Multimedia');
    assert.equal(f.translateCurrent('Permiso requerido'), 'Permiso requerido');
    assert.deepEqual(f.writes, ['en', 'es']);
  });
});

test('a slow preference read cannot overwrite a new choice', async () => {
  const f = fixture(null, true);
  await mounted(f, async state => {
    await React.act(async () => { await state().setLanguage('es'); });
    await React.act(async () => { f.finishRead('en'); });
    assert.equal(state().language, 'es');
    assert.equal(f.getLocale(), 'es-MX');
  });
});

test('rapid language selections persist in order and the last choice wins', async () => {
  const f = fixture();
  await mounted(f, async state => {
    await React.act(async () => { await Promise.all([state().setLanguage('es'), state().setLanguage('en'), state().setLanguage('es')]); });
    assert.equal(state().language, 'es');
    assert.deepEqual(f.writes, ['es', 'en', 'es']);
  });
});

test('interpolation retains arbitrary user values and whitespace without translating content', () => {
  const f = fixture();
  assert.equal(f.translateText('en', '  Guardar  '), '  Save  ');
  assert.equal(f.translateText('en', '  '), '  ');
  assert.equal(f.translateText('en', 'No hay canales que coincidan con "{value0}". Intenta con otro término.', { value0: 'Villa Azul {value1}' }), 'No channels match "Villa Azul {value1}". Try another search.');
  assert.equal(f.translateText('en', 'Test notificaciones – Villa Azul'), 'Test notificaciones – Villa Azul');
});

test('every role and representative user-visible flow has an English translation', async () => {
  const f = fixture();
  await mounted(f, state => {
    assert.deepEqual(Object.keys(f.TRANSLATIONS.es).sort(), Object.keys(f.TRANSLATIONS.en).sort());
    for (const role of ['admin', 'supervisor_instalacion', 'instalador', 'aux_instalacion', 'integrador', 'aux_integracion', 'infraestructura', 'aux_infraestructura', 'servicios', 'aux_servicios', 'aux_operaciones', 'supervisor', 'tecnico']) {
      assert.ok(!f.getRoleLabel(role, state().t).startsWith('role.'));
    }
    for (const key of ['CONTROLES DE ADMINISTRADOR', 'GPS Requerido', 'Generar y Enviar Invitación', 'No se encontró la tarea', 'Cargando formulario de Google...', 'profile.logout', 'Hoja de cálculo Excel']) {
      assert.notEqual(state().t(key), key, key);
    }
  });
});

test('all literal interface translation calls resolve, and database filters keep raw identifiers', () => {
  const f = fixture(); const missing = [];
  const roots = [path.join(__dirname, '../app'), path.join(__dirname, '../components')];
  for (const root of roots) {
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const filename = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(filename);
        else if (filename.endsWith('.tsx')) {
          const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
          function visit(node) {
            if (ts.isCallExpression(node)) {
              const name = node.expression.getText(ast);
              if (['tr', 't', 'translateInterface'].includes(name) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
                const key = node.arguments[0].text.trim();
                if (!(key in f.UI_TRANSLATIONS) && !(key in f.TRANSLATIONS.en)) missing.push(`${entry.name}: ${key}`);
              }
              if (/\.(from|eq)$/.test(name) || name === 'setSelectedTab') {
                for (const arg of node.arguments) assert.ok(!ts.isCallExpression(arg) || !['t', 'tr'].includes(arg.expression.getText(ast)), `${filename}: translated database identifier`);
              }
            }
            ts.forEachChild(node, visit);
          }
          visit(ast);
        }
      }
    }
    walk(root);
  }
  assert.deepEqual(missing, []);
});
