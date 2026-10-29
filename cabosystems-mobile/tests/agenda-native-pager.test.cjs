const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { agendaPagerPages } = require('./helpers/agenda-loader.cjs')()('agendaPagerPages');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('native page identities cover leap dates and stay unique at calendar limits', () => {
  const pages = agendaPagerPages('2028-01-31', 'month');
  assert.equal(pages.length, 25);
  assert.equal(pages.find(page => page.position === 1).anchor, '2028-02-29');
  for (const anchor of ['1900-01-01', '9999-12-31']) {
    const bounded = agendaPagerPages(anchor, 'month');
    assert.equal(new Set(bounded.map(page => page.anchor)).size, bounded.length);
    assert.equal(bounded.filter(page => page.position === 0).length, 1);
  }
});

test('consecutive native pages do not rebuild or reposition the list while the title catches up', async () => {
  const scrolls = [], moves = [], destinations = [];
  const FlatList = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: value => scrolls.push(value) }), []);
    return React.createElement('NativeList', props);
  });
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/agenda/AgendaNativePager.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const imports = { react: React, 'react-native': { FlatList, View: 'View', StyleSheet: { create: value => value } }, '@/lib/agendaPagerPages': { agendaPagerPages } };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  const { AgendaNativePager } = module.exports;
  let props = { anchor: '2028-01-31', pagePosition: 4, view: 'month', enabled: true, renderPage: anchor => React.createElement('Month', { anchor }), onMove: (direction, position, anchor) => { moves.push([direction, position]); destinations.push(anchor); } };
  let renderer;
  const update = async patch => { props = { ...props, ...patch }; await React.act(async () => renderer.update(React.createElement(AgendaNativePager, props))); };
  const native = () => renderer.root.findByType('NativeList');
  const end = index => native().props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: index * 390 } } });
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(AgendaNativePager, props)); });
    await React.act(async () => renderer.root.findByProps({ testID: 'agenda-native-pager' }).props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } }));
    const initial = native().props;
    assert.equal(initial.pagingEnabled, true); assert.equal(initial.horizontal, true);
    assert.deepEqual(Array.from(initial.data, item => item.position).slice(12, 15), [4, 5, 6]);
    end(13); end(14); end(15);
    assert.deepEqual(moves, [[1, 5], [1, 6], [1, 7]]);
    assert.deepEqual(destinations, ['2028-02-29', '2028-03-31', '2028-04-30']);
    await update({ anchor: '2028-04-30', pagePosition: 7 });
    assert.equal(native().props.data, initial.data);
    assert.equal(native().props.renderItem, initial.renderItem);
    assert.equal(native().props.getItemLayout, initial.getItemLayout);
    assert.equal(native().props.initialScrollIndex, initial.initialScrollIndex);
    assert.equal(scrolls.length, 0, 'Committing months must not reset native motion');
    end(16); assert.deepEqual(moves.at(-1), [1, 8]);
    await update({ enabled: false });
    end(17); assert.equal(moves.length, 4, 'Hidden routes cannot change the selected date');
    assert.equal(scrolls.length, 1);
    const stale = native().props.onMomentumScrollEnd;
    await React.act(async () => renderer.unmount()); renderer = null;
    stale({ nativeEvent: { contentOffset: { x: 18 * 390 } } });
    assert.equal(moves.length, 4);
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
