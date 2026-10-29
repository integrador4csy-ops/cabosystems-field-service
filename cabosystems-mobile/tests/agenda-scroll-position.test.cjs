const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('switching months resets once; delayed event updates cannot anchor or scroll to tasks', async () => {
  const scrolls = [];
  const FlashList = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: value => scrolls.push(value) }), []);
    return React.createElement('FlashList', props);
  });
  const imports = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    '@shopify/flash-list': { FlashList },
    '@/constants/Theme': { AgendaPalette: {} },
    '@/lib/agendaSearch': { sortAgendaSearch: values => values },
    '@/lib/agenda': {}, '@/lib/companyAgendaPresentation': {},
    './CompanyAgendaEvent': { CompanyAgendaEvent: 'CompanyAgendaEvent' },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../components/agenda/CompanyAgendaSearchResults.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Map, Set, Date, AbortController,
    require(name) { if (name in imports) return imports[name]; throw new Error(name); },
  });
  const { CompanyAgendaSearchResults } = module.exports;
  let props = { periodKey: 'month:november', colors: {}, client: {}, query: '', today: '2026-11-01', locale: 'es-MX', hiddenCalendars: [], revision: 0, header: React.createElement('NovemberCalendar'), bottomInset: 0,
    onOpen() {}, onDate() {}, onClear() {},
    fallback: { rows: [], renderItem: () => null, empty: React.createElement('Empty'), refreshing: false, onRefresh() {} },
  };
  let renderer;
  const render = () => React.createElement(CompanyAgendaSearchResults, props);
  try {
    await React.act(async () => { renderer = Renderer.create(render()); });
    assert.equal(scrolls.length, 1);
    props = { ...props, periodKey: 'month:october', header: React.createElement('OctoberCalendar'), fallback: { ...props.fallback, rows: [{ kind: 'heading', date: '2026-10-01', count: 1 }] } };
    await React.act(async () => renderer.update(render()));
    assert.equal(scrolls.length, 2, 'One top reset for the new month');
    for (let update = 1; update <= 3; update++) {
      props = { ...props, revision: update, header: React.createElement('OctoberCalendar', { count: update }), fallback: { ...props.fallback, rows: [...props.fallback.rows, { kind: 'heading', date: `2026-10-0${update + 1}`, count: update }] } };
      await React.act(async () => renderer.update(render()));
      assert.equal(scrolls.length, 2, 'Refreshes must preserve the user’s current scroll position');
      assert.equal(renderer.root.findByType('FlashList').props.maintainVisibleContentPosition.disabled, true, 'Do not anchor old task rows when dates or header height change');
    }
    assert.equal(scrolls.every(value => value.offset === 0 && value.animated === false), true);
    let renderedRows = 0;
    props = { ...props, preview: true, fallback: { ...props.fallback, rows: Array.from({length: 100}, (_, index) => ({kind: 'heading', date: String(index), count: 1})), renderItem() { renderedRows++; return React.createElement('PreviewRow'); } } };
    await React.act(async () => renderer.update(render()));
    assert.equal(renderer.root.findAllByType('FlashList').length, 0, 'Adjacent pages do not mount more list engines');
    assert.equal(renderedRows, 24, 'Preview work is bounded regardless of event count');
    props = { ...props, preview: false };
    await React.act(async () => renderer.update(render()));
    assert.equal(renderer.root.findByType('FlashList').props.data.length, 100, 'The active page retains every event');
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
