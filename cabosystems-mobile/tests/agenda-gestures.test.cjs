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
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return module.exports;
}
const dates = load('lib/agenda.ts');
const gestures = load('lib/agendaGestures.ts', { './agenda': dates });

test('horizontal swipes advance left and go back right, including short intentional flings', () => {
  assert.equal(gestures.agendaSwipeDirection(-80, 4), 1);
  assert.equal(gestures.agendaSwipeDirection(80, -4), -1);
  assert.equal(gestures.agendaSwipeDirection(-32, 2, -900), 1);
  assert.equal(gestures.agendaSwipeDirection(32, 2, 900), -1);
  assert.equal(gestures.agendaSwipeDirection(32, 2, -900), 0);
});

test('taps, slow short drags, vertical scroll, diagonals and invalid data do not change dates', () => {
  for (const args of [[0, 0], [10, 2, 1500], [35, 2], [5, 100], [-5, -100], [64, 55], [100, 80], [NaN, 0], [80, Infinity], [80, 0, NaN]]) {
    assert.equal(gestures.agendaSwipeDirection(...args), 0, JSON.stringify(args));
  }
});

test('navigation uses calendar months, seven-day weeks and days across leap years and date limits', () => {
  for (const [anchor, view, direction, expected] of [
    ['2026-01-31', 'month', 1, '2026-02-28'],
    ['2028-01-31', 'month', 1, '2028-02-29'],
    ['2026-01-15', 'month', -1, '2025-12-15'],
    ['2026-12-28', 'week', 1, '2027-01-04'],
    ['2026-01-05', 'week', -1, '2025-12-29'],
    ['2026-12-31', 'day', 1, '2027-01-01'],
    ['2028-03-01', 'day', -1, '2028-02-29'],
    ['1900-01-01', 'day', -1, '1900-01-01'],
    ['9999-12-31', 'day', 1, '9999-12-31'],
    ['9999-12-31', 'month', 1, '9999-12-31'],
  ]) assert.equal(gestures.moveAgendaPeriod(anchor, view, direction), expected);
});

async function animationHarness(overrides = {}) {
  const values = [], animations = [], moves = [], bridge = [];
  let paused = false;
  let pan, renderer;
  const builder = {
    enabled() { return this; }, activeOffsetX() { return this; }, failOffsetY() { return this; }, maxPointers() { return this; },
    onStart(callback) { this.start = callback; return this; }, onUpdate(callback) { this.update = callback; return this; },
    onEnd(callback) { this.end = callback; return this; }, onFinalize(callback) { this.finalize = callback; return this; },
  };
  const stop = shared => {
    if (shared.animation) { shared.animation.cancelled = true; shared.animation.callback?.(false); shared.animation = null; }
  };
  const useSharedValue = initial => {
    const ref = React.useRef(null);
    if (!ref.current) {
      let value = initial;
      const shared = { animation: null, get value() { return value; }, set value(next) {
        stop(shared);
        if (next?.kind) { shared.animation = next; animations.push({ ...next, from: value, shared, source: next }); }
        else value = next;
      } };
      ref.current = shared; values.push(shared);
    }
    return ref.current;
  };
  const { AgendaSwipeArea } = load('components/agenda/AgendaSwipeArea.tsx', {
    react: React,
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'react-native-gesture-handler': { Gesture: { Pan() { pan = Object.create(builder); return pan; } }, GestureDetector: 'GestureDetector' },
    'react-native-worklets': { scheduleOnUI: (f, ...args) => f(...args), scheduleOnRN: (f, ...args) => paused ? bridge.push(() => f(...args)) : f(...args) },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, cancelAnimation: stop,
      Easing: { out: value => value, cubic: value => value }, ReduceMotion: { System: 'system' },
      useSharedValue, useAnimatedStyle: factory => ({ get transform() { return factory().transform; } }),
      withTiming: (to, config, callback) => ({ kind: 'timing', to, config, callback }),
      withSpring: (to, config) => ({ kind: 'spring', to, config }),
    },
    '@/lib/agendaGestures': gestures,
  });
  let props = { children: 'October', previousPages: ['September', 'August', 'July'], nextPages: ['November', 'December', 'January'], scopeKey: 'fixture', pagePosition: 0, periodKey: 'month:2026-10', enabled: true, onMove: direction => moves.push(direction), ...overrides };
  const render = () => React.createElement(AgendaSwipeArea, props);
  await React.act(async () => { renderer = Renderer.create(render()); });
  const layout = width => renderer.root.findByType('View').props.onLayout({ nativeEvent: { layout: { width } } });
  layout(390);
  return {
    moves, animations, values, layout, pause() { paused = true; }, flush() { while (bridge.length) bridge.shift()(); }, get pan() { return pan; },
    page(id) { return renderer.root.findByProps({ testID: `agenda-page-${id}` }); },
    position(id) { return renderer.root.findByProps({ testID: `agenda-page-${id}` }).props.style[1].transform[0].translateX; },
    finish(animation) {
      if (animation.source.cancelled) return;
      animation.shared.animation = null; animation.shared.value = animation.to; animation.callback?.(true);
    },
    async update(patch) { props = { ...props, ...patch }; await React.act(async () => { renderer.update(render()); }); },
    async close() { await React.act(async () => { renderer.unmount(); }); },
  };
}


function swipe(h, dx = -85) {
  h.pan.start(); h.pan.update({ translationX: dx });
  h.pan.end({ translationX: dx, translationY: 0, velocityX: Math.sign(dx) * 900 });
}

test('moving the window retains four existing month previews rather than remounting all six', async () => {
  const mounts = [], unmounts = [];
  function Month({ month }) {
    React.useEffect(() => { mounts.push(month); return () => unmounts.push(month); }, [month]);
    return React.createElement('Month', { month });
  }
  const pages = months => months.map(month => React.createElement(Month, { key: month, month }));
  const h = await animationHarness({ previousPages: pages([-1, -2, -3]), nextPages: pages([1, 2, 3]) });
  try {
    mounts.length = 0; unmounts.length = 0;
    await h.update({ pagePosition: 1, periodKey: 'month:2026-11', previousPages: pages([0, -1, -2]), nextPages: pages([2, 3, 4]) });
    assert.deepEqual(mounts.sort((a, b) => a - b), [0, 4]);
    assert.deepEqual(unmounts.sort((a, b) => a - b), [-3, 1]);
  } finally { await h.close(); }
});

test('swipes send their absolute destination even when JS and the title have not caught up', async () => {
  const requests = [];
  const h = await animationHarness({ onMove: (direction, position) => requests.push([direction, position]) });
  try {
    h.pause(); swipe(h); swipe(h); swipe(h, 85);
    assert.equal(requests.length, 0);
    h.flush();
    assert.deepEqual(requests, [[1, 1], [1, 2], [-1, 1]]);
    await h.update({ pagePosition: 1, periodKey: 'month:2026-11' });
    swipe(h); h.flush(); assert.deepEqual(requests.at(-1), [1, 2]);
  } finally { await h.close(); }
});
test('rapid swipes interrupt animations without waiting for the month title or React commit', async () => {
 const h=await animationHarness();try {
  h.pan.start();h.pan.update({translationX:-85});
  assert.equal(h.position('next'),305); assert.equal(h.position('previous'),-475);
  assert.equal(h.page('next').props.importantForAccessibility,'no-hide-descendants');
  h.pan.end({translationX:-85,translationY:0,velocityX:-900});
  const first=h.animations.at(-1), pan=h.pan;
  assert.equal(first.to,-390);assert.ok(first.config.duration>=80 && first.config.duration<=200);
  assert.equal(first.config.reduceMotion,'system');assert.deepEqual(h.moves,[1]);
  swipe(h);assert.equal(first.source.cancelled,true);assert.equal(h.animations.at(-1).to,-780);
  swipe(h);assert.equal(h.animations.at(-1).to,-1170);assert.deepEqual(h.moves,[1,1,1]);
  h.finish(h.animations.at(-1));assert.equal(h.position('next-3'),0);
  swipe(h);assert.deepEqual(h.moves,[1,1,1],'Cannot exceed the prepared buffer');h.finish(h.animations.at(-1));
  await h.update({pagePosition:3,periodKey:'month:2027-01',children:'January'});
  assert.equal(Math.abs(h.position('current')),0);assert.equal(h.pan,pan,'Native gesture survives period commits');
  swipe(h);assert.deepEqual(h.moves,[1,1,1,1]);
 }finally{await h.close();}
});
test('React acknowledgment during another drag preserves content under the finger', async () => {
 const h=await animationHarness();try{
  swipe(h);h.values[0].value=-180;
  h.pan.start();h.pan.update({translationX:-60});assert.equal(h.position('next'),150);
  await h.update({pagePosition:1,periodKey:'month:2026-11',children:'November'});
  assert.equal(h.position('current'),150);
  h.pan.update({translationX:-90});assert.equal(h.position('current'),120);
  h.pan.end({translationX:-90,translationY:0,velocityX:-900});
  assert.equal(h.animations.at(-1).to,-780);assert.deepEqual(h.moves,[1,1]);
 }finally{await h.close();}
});
test('month commits do not cancel or restart the second swipe animation', async()=>{
 const h=await animationHarness();try{
  swipe(h);swipe(h);
  const second=h.animations.at(-1), count=h.animations.length;
  await h.update({pagePosition:1,periodKey:'month:2026-11',children:'November'});
  assert.equal(Boolean(second.source.cancelled),false);
  assert.equal(h.animations.length,count,'The existing timing curve must continue');
  await h.update({pagePosition:2,periodKey:'month:2026-12',children:'December'});
  assert.equal(Boolean(second.source.cancelled),false);
  assert.equal(h.animations.length,count);
  h.finish(second);assert.equal(h.position('current'),0);
 }finally{await h.close();}
});

test('rapid direction changes retain every step across intermediate acknowledgments', async()=>{
 const h=await animationHarness();try{
  swipe(h);swipe(h,85);assert.deepEqual(h.moves,[1,-1]);assert.equal(Math.abs(h.position('current')),0);
  await h.update({pagePosition:1,periodKey:'month:2026-11'});assert.equal(h.position('current'),390);
  await h.update({pagePosition:0,periodKey:'month:2026-10'});
  assert.equal(Math.abs(h.position('current')),0);assert.deepEqual(h.moves,[1,-1]);
 }finally{await h.close();}
});
test('short, aborted and date-limit gestures return to the committed page',async()=>{
 const h=await animationHarness({canGoNext:false});try{
  h.pan.start();h.pan.update({translationX:-100});assert.equal(h.position('current'),-15);
  h.pan.end({translationX:-100,translationY:0,velocityX:-900});h.finish(h.animations.at(-1));
  assert.equal(Math.abs(h.position('current')),0);assert.deepEqual(h.moves,[]);
  swipe(h,20);assert.equal(Math.abs(h.animations.at(-1).to),0);h.finish(h.animations.at(-1));
  h.pan.start();h.pan.update({translationX:90});h.pan.finalize({},false);
  assert.equal(Math.abs(h.animations.at(-1).to),0);assert.deepEqual(h.moves,[]);
 }finally{await h.close();}
});
test('search, external date changes and unmount discard obsolete queued requests',async()=>{
 for(const interruption of ['search','date','unmount']){
  const h=await animationHarness();let closed=false;try{
   h.pause();swipe(h);
   if(interruption==='search')await h.update({enabled:false});
   if(interruption==='date')await h.update({scopeKey:'external',periodKey:'day:2026-10-28'});
   if(interruption==='unmount'){await h.close();closed=true;}
   h.flush();assert.deepEqual(h.moves,[],interruption);assert.equal(h.values[2].value,false);
   if(!closed)assert.equal(Math.abs(h.position('current')),0);
  }finally{if(!closed)await h.close();}
 }
});
test('rotation cancels unfinished drags and preserves committed navigation',async()=>{
 const h=await animationHarness();try{
  h.pan.start();h.pan.update({translationX:-85});h.layout(720);
  h.pan.end({translationX:-85,translationY:0,velocityX:-900});
  assert.deepEqual(h.moves,[]);assert.equal(Math.abs(h.position('current')),0);
  swipe(h);h.layout(390);assert.deepEqual(h.moves,[1]);assert.equal(h.position('next'),0);
 }finally{await h.close();}
});
