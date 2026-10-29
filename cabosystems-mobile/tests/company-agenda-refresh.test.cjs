const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/agenda/CompanyAgendaScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('agenda.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') {
    const callback = node.arguments[0]?.arguments?.[0];
    if (callback?.getText(ast).includes('company_agenda_mobile_')) effect = callback.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect);
test('the visible mobile calendar refreshes Google events, not just the search index, and stops on blur', async () => {
  const modes = []; const polls = []; let removed = 0;
  const channel = { on: () => channel, subscribe: () => channel };
  const sandbox = {
    owner: 'user', sequence: { current: 0 }, Date,
    AppState: { currentState: 'active' },
    load: async mode => { modes.push(mode); },
    setToday() {}, dateKey: () => '2026-10-27',
    supabase: { channel: () => channel, removeChannel: async () => { removed++; } },
    startForegroundPolling(task, interval) { const poll = { task, interval, stopped: false }; polls.push(poll); return () => { poll.stopped = true; }; },
    afterTabPaint: task => task(),
    setTimeout, clearTimeout,
  };
  const code = ts.transpileModule(`globalThis.effect = (${effect});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, sandbox);
  const stop = sandbox.effect();
  await polls[0].task(); await polls[0].task();
  assert.equal(polls[0].interval, 60000); assert.deepEqual(modes, [false, 'silent']);
  stop(); await polls[0].task();
  assert.deepEqual(modes, [false, 'silent']); assert.ok(polls.every(poll => poll.stopped)); assert.equal(removed, 1);
});

test('agenda renders with Expo Router focus alone and disables swipes when the route loses focus', async () => {
  const React = require('react');
  const Renderer = require('react-test-renderer');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const evaluate = (text, imports) => {
    const module = { exports: {} };
    vm.runInNewContext(compile(text), { exports: module.exports, module, Date, Map, Set, Intl, console, setTimeout, clearTimeout,
      require(name) {
        if (name in imports) return imports[name];
        throw new Error(`Unexpected navigation or native dependency: ${name}`);
      },
    });
    return module.exports;
  };
  const dates = evaluate(fs.readFileSync(path.join(__dirname, '../lib/agenda.ts'), 'utf8'), {});
  const copy = evaluate(fs.readFileSync(path.join(__dirname, '../lib/companyAgendaCopy.ts'), 'utf8'), {});
  const cache = evaluate(fs.readFileSync(path.join(__dirname, '../lib/agendaPeriodCache.ts'), 'utf8'), {});
  const gestures = evaluate(fs.readFileSync(path.join(__dirname, '../lib/agendaGestures.ts'), 'utf8'), { './agenda': dates });
  const windowManager = { cache: new cache.AgendaPeriodCache(async () => []), anchor: dates.dateKey(new Date()), view: 'week', ready: true, calendars: [], subscribe: () => () => {}, initialize: async () => {}, select() {}, getCalendars: async () => [], invalidate() {} };
  let routeFocused = true;
  const focusListeners = new Set();
  let screenRenders = 0;
  const channel = { on: () => channel, subscribe: () => channel };
  const colors = { colors: {}, loading: false, failed: false, reload: async () => {}, save: async () => {} };
  const component = name => ({ [name]: name });
  const { default: Screen } = evaluate(source, {
    react: React,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', AppState: { currentState: 'active' }, StyleSheet: { create: value => value } },
    'lucide-react-native': { CalendarDays: 'CalendarDays', RefreshCw: 'RefreshCw' },
    'expo-router': { useFocusEffect(callback) {
      React.useEffect(() => {
        let cleanup;
        const notify = () => { cleanup?.(); cleanup = routeFocused ? callback() : undefined; };
        focusListeners.add(notify); notify();
        return () => { focusListeners.delete(notify); cleanup?.(); };
      }, [callback]);
    } },
    'expo-status-bar': component('StatusBar'),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/constants/Theme': { AgendaPalette: {} },
    '@/lib/auth': { useAuth: () => { screenRenders++; return { profile: { id: 'fixture', activo: true, rol: 'aux_integracion' } }; } },
    '@/lib/i18n': { useTranslation: () => ({ language: 'es' }) },
    '@/lib/agenda': dates,
    '@/lib/agendaGestures': gestures,
    '@/lib/agendaPreviewCache': evaluate(fs.readFileSync(path.join(__dirname, '../lib/agendaPreviewCache.ts'), 'utf8'), {}),
    '@/lib/companyAgenda': { canManageCompanyAgenda: () => false, companyDays: date => [date], companyRows: () => [] },
    '@/lib/agendaWindowService': { getAgendaWindow: () => windowManager },
    '@/lib/companyAgendaApi': { getCompanyEvents: async () => [], getGoogleCalendars: async () => [] }, '@/lib/companyAgendaCache': {},
    '@/lib/companyAgendaCopy': copy, '@/lib/companyAgendaPresentation': {},
    '@/lib/supabase': { supabase: { channel: () => channel, removeChannel: async () => {} } },
    '@/lib/agendaSearchClient': { AgendaSearchClient: class { clear() {} } },
    '@/lib/foregroundPolling': { startForegroundPolling: () => () => {} },
    '@/lib/tabPreparation': { afterTabPaint: task => task() },
    '@/lib/useCalendarColors': { useCalendarColors: () => colors },
    './CompanyAgendaControls': { ...component('CompanyAgendaControls'), ...component('CompanyAgendaTopBar'), ...component('CompanyAgendaGrid') },
    './CompanyAgendaEvent': component('CompanyAgendaEvent'),
    './CompanyAgendaSearchResults': component('CompanyAgendaSearchResults'),
    './CompanyCalendarFilters': component('CompanyCalendarFilters'),
    './CompanyEventModal': component('CompanyEventModal'),
    './AgendaSwipeArea': component('AgendaSwipeArea'),
    './AgendaNativePager': component('AgendaNativePager'),
  });
  let renderer;
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(Screen)); });
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.enabled, true);
    assert.equal(renderer.root.findAllByType('CompanyAgendaControls').length, 1, 'Only one shared toolbar is rendered');
    const pager = renderer.root.findByType('AgendaSwipeArea');
    assert.equal(pager.findAllByType('CompanyAgendaControls').length, 0, 'Toolbar stays outside the sliding surface');
    assert.equal(renderer.root.findByType('CompanyAgendaControls').props.showCalendar, false);
    for (const neighbor of [...pager.props.previousPages, ...pager.props.nextPages]) {
      assert.ok(neighbor, 'Both adjacent periods are prepared');
      assert.equal(neighbor.props.preview, true, 'All six neighbors use lightweight snapshots');
      assert.equal(neighbor.props.header.props.children.type, 'CompanyAgendaGrid', 'Neighbors contain dates, not repeated toolbars');
      assert.equal(neighbor.props.header.props.style.marginHorizontal, -20, 'Calendar grid reaches the page seam');
    }
    const initialAnchor = renderer.root.findByType('CompanyAgendaControls').props.anchor;
    const scope = pager.props.scopeKey;
    await React.act(async () => { pager.props.onMove(1); pager.props.onMove(1); pager.props.onMove(-1); });
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.pagePosition, 1);
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.scopeKey, scope);
    const expectedAnchor = [1, 1, -1].reduce((date, direction) => gestures.moveAgendaPeriod(date, 'week', direction), initialAnchor);
    assert.equal(renderer.root.findByType('CompanyAgendaControls').props.anchor, expectedAnchor);
    routeFocused = false;
    const previousPages = renderer.root.findByType('AgendaSwipeArea').props.previousPages;
    const nextPages = renderer.root.findByType('AgendaSwipeArea').props.nextPages;
    const beforeFocusChange = screenRenders;
    await React.act(async () => { for (const notify of [...focusListeners]) notify(); });
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.enabled, false);
    assert.equal(screenRenders, beforeFocusChange, 'Blur only updates the swipe gate, not the seven-page screen');
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.previousPages, previousPages, 'Leaving the tab reuses prepared calendar pages');
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.nextPages, nextPages);
    routeFocused = true;
    await React.act(async () => { for (const notify of [...focusListeners]) notify(); });
    assert.equal(renderer.root.findByType('AgendaSwipeArea').props.enabled, true);
    assert.equal(screenRenders, beforeFocusChange, 'Focus reuses the screen without an extra render');
    await React.act(async () => renderer.root.findByType('CompanyAgendaControls').props.onView('month'));
    const native = renderer.root.findByType('AgendaNativePager');
    assert.equal(native.props.enabled, true);
    const month = native.props.renderPage(native.props.anchor);
    assert.equal(month.props.preview, undefined, 'Native pages keep their full scrollable list');
    assert.equal(month.props.header.props.children.type, 'CompanyAgendaGrid');
    const monthAnchor = native.props.anchor;
    await React.act(async () => { native.props.onMove(9, 10); native.props.onMove(1, 11); });
    assert.equal(renderer.root.findByType('AgendaNativePager').props.pagePosition, 0);
    assert.equal(renderer.root.findByType('CompanyAgendaControls').props.anchor, gestures.moveAgendaPeriod(monthAnchor, 'month', 9), 'A queued old-page callback cannot shift the recentered calendar');
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
