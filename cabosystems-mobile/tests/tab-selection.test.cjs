const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture() {
  const values = [], animations = [];
  const reanimated = {
    __esModule: true, default: { View: 'AnimatedView', Text: 'AnimatedText' },
    Easing: { out: value => value, cubic: 'cubic' }, ReduceMotion: { System: 'system' },
    useSharedValue(initial) { const ref = React.useRef(); if (!ref.current) { ref.current = { value: initial }; values.push(ref.current); } return ref.current; },
    useAnimatedStyle(factory) {
      const ref = React.useRef(factory); ref.current = factory;
      return React.useMemo(() => new Proxy({}, { get: (_, key) => ref.current()[key] }), []);
    },
    withTiming: (target, config) => { animations.push({ target, config }); return target; },
    interpolateColor: (value, _, colors) => value === 1 ? colors[1] : colors[0],
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/ConnectedTabBar.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Math, require: name => {
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (name === 'react-native') return { View: 'View', Pressable: 'Pressable', useWindowDimensions: () => ({ width: 400 }), StyleSheet: { create: value => value, absoluteFill: {} } };
    if (name === 'react-native-reanimated') return reanimated;
    if (name === '@/constants/Theme') return { Colors: { primary: '#f78c26' } };
    throw Error(name);
  } });
  return { ...exports, values, animations };
}

test('one position drives the capsule, icon and label without JS renders between frames', async () => {
  const api = fixture(); let renderer;
  const tabs = ['index', 'schedule', 'users', 'chat']; const Icon = () => null;
  const render = activeTab => React.createElement(api.ConnectedTabBarProvider, { activeTab, tabs },
    React.createElement(api.ConnectedTabBackground),
    ...tabs.map(tab => React.createElement(React.Fragment, { key: tab }, React.createElement(api.ConnectedTabIcon, { tab, Icon }), React.createElement(api.ConnectedTabLabel, { tab }, tab))));
  const style = id => renderer.root.findByProps({ testID: id }).props.style.at(-1);
  try {
    await React.act(async () => { renderer = Renderer.create(render('index')); });
    assert.equal(style('tab-icon-light-index').opacity, 1);
    assert.equal(style('tab-label-index').color, '#FFFFFF');
    api.values[0].value = 0.5;
    assert.equal(style('tab-icon-light-index').opacity, 0);
    assert.equal(style('tab-icon-light-schedule').opacity, 0);
    assert.equal(style('tab-label-schedule').color, '#343e48');
    assert.equal(style('connected-tab-capsule').transform[0].translateX, 44.5);
    await React.act(async () => { renderer.update(render('chat')); });
    assert.equal(style('connected-tab-capsule').transform[0].translateX, 267);
    assert.equal(style('tab-icon-light-chat').opacity, 1);
    assert.equal(style('tab-label-chat').color, '#FFFFFF');
    assert.equal(style('tab-label-index').color, '#343e48');
    assert.ok(api.animations.every(animation => animation.config.duration === 220 && animation.config.reduceMotion === 'system'));
    assert.equal(renderer.root.findByProps({ testID: 'connected-tab-capsule' }).props.style[0].backgroundColor, '#f78c26');
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});

test('the hit target preserves accessibility and does not cover the shared capsule', () => {
  const api = fixture(); const onPress = () => {};
  const element = api.ConnectedTabButton({ 'aria-selected': true, accessibilityLabel: 'Agenda', onPress, style: { backgroundColor: '#FFFFFF' } });
  assert.equal(Object.assign({}, ...element.props.style).backgroundColor, 'transparent');
  assert.equal(element.props.onPress, onPress); assert.equal(element.props.accessibilityLabel, 'Agenda');
});
