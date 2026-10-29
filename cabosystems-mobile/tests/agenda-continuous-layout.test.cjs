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
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, Date, Map, Set, Intl, require(name) { if (name in imports) return imports[name]; throw Error(name); } });
  return module.exports;
}
const dates = load('lib/agenda.ts');
const { COMPANY_AGENDA_COPY } = load('lib/companyAgendaCopy.ts');
const { CompanyAgendaControls, CompanyAgendaGrid } = load('components/agenda/CompanyAgendaControls.tsx', {
  react: React,
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { create: value => value } },
  'lucide-react-native': { ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight', Plus: 'Plus', Search: 'Search', X: 'X' },
  '@/constants/Theme': { AgendaPalette: {}, Colors: {} },
  '@/components/HeaderCaboSystems': { HeaderCaboSystems: 'HeaderCaboSystems' },
  '@/lib/agenda': dates, './AgendaDatePicker': { AgendaDatePicker: 'AgendaDatePicker' },
});
const props = { copy: COMPANY_AGENDA_COPY.es, locale: 'es-MX', view: 'week', anchor: '2026-10-21', today: '2026-10-28', days: Array.from({ length: 7 }, (_, index) => dates.shiftDate('2026-10-19', index)), counts: new Map(), query: '', heading: '19–25 de octubre', onSearch() {}, onView() {}, onDate() {}, onMove() {}, onToday() {} };
const dateButtons = renderer => renderer.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith(props.copy.selectDay));

test('shared controls omit the date grid while standalone controls retain their calendar', async () => {
  let renderer;
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(CompanyAgendaControls, { ...props, showCalendar: false })); });
    assert.equal(dateButtons(renderer).length, 0);
    assert.equal(renderer.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityRole === 'tab').length, 3);
    await React.act(async () => renderer.update(React.createElement(CompanyAgendaControls, props)));
    assert.equal(dateButtons(renderer).length, 7);
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});

test('sliding grid contains only dates and preserves date selection without repeating toolbar controls', async () => {
  let renderer; const selected = [];
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(CompanyAgendaGrid, { ...props, onDate: day => selected.push(day), onView: view => selected.push(view) })); });
    assert.equal(dateButtons(renderer).length, 7);
    assert.equal(renderer.root.findAllByType('TextInput').length, 0);
    assert.equal(renderer.root.findAllByType('AgendaDatePicker').length, 0);
    dateButtons(renderer)[2].props.onPress();
    assert.deepEqual(selected, ['2026-10-21', 'day']);
    await React.act(async () => renderer.update(React.createElement(CompanyAgendaGrid, { ...props, view: 'day' })));
    assert.equal(renderer.toJSON(), null);
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
