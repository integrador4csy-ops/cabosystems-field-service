const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const exp={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/tabBarOrder.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exp});
const {orderTabBarState}=exp;
test('visual tab order preserves focus, hidden routes and the original registry state',()=>{
 const routes=['index','fab','chat','users','checks','profile','schedule'].map(name=>({name,key:name+'-key'}));const state={routes,index:2,key:'tabs'};
 const admin=orderTabBarState(state,['index','checks','schedule','users','chat']);
 assert.deepEqual(Array.from(admin.routes,r=>r.name),['index','checks','schedule','users','chat','fab','profile']);
 assert.equal(admin.routes[admin.index].key,'chat-key');assert.equal(state.routes,routes);assert.equal(state.index,2);
 const tech=orderTabBarState(state,['fab','index','schedule','chat']);
 assert.deepEqual(Array.from(tech.routes,r=>r.name),['fab','index','schedule','chat','users','checks','profile']);
 assert.equal(tech.routes[tech.index].key,'chat-key');
});
test('declared tabs match Expo seeded route order to avoid stale reconciliation actions',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app/(tabs)/_layout.tsx'),'utf8');
 const ast=ts.createSourceFile('tabs.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const names=[];
 function visit(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='Tabs.Screen'){const name=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='name');names.push(name.initializer.text);}ts.forEachChild(n,visit);}visit(ast);
 const {sortRoutesWithInitial}=require('../node_modules/expo-router/build/sortRoutes.js');
 const seeded=names.map(route=>({route})).sort(sortRoutesWithInitial('index')).map(n=>n.route);
 assert.deepEqual(names,seeded);
});

test('villa locations are a standalone stack route reachable from field operations',()=>{
 const layout=fs.readFileSync(path.join(__dirname,'../app/(tabs)/_layout.tsx'),'utf8');
 const profile=fs.readFileSync(path.join(__dirname,'../app/(tabs)/profile.tsx'),'utf8');
 assert.doesNotMatch(layout,/name="locations"/);
 assert.doesNotMatch(layout,/tabOrder[^\n]*locations/);
 assert.ok(profile.includes("router.push('/locations')"));
 const root=fs.readFileSync(path.join(__dirname,'../app/_layout.tsx'),'utf8');
 assert.match(root,/Stack\.Screen name="locations"/);
});

test('Android Back returns to Tasks only while a secondary tab is focused',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app/(tabs)/_layout.tsx'),'utf8');
 const ast=ts.createSourceFile('tabs.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useFocusEffect'&&n.arguments[0].getText(ast).includes('hardwareBackPress'))callback=n.arguments[0].arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(callback);
 let handler,removed=false;const navigated=[];
 const env={currentTab:'index',router:{navigate:route=>navigated.push(route)},BackHandler:{addEventListener:(event,fn)=>{assert.equal(event,'hardwareBackPress');handler=fn;return {remove:()=>{removed=true;}};}}};
 vm.runInNewContext(ts.transpileModule('globalThis.focus = ('+callback+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
 assert.equal(env.focus(),undefined);assert.equal(handler,undefined);
 env.currentTab='users';const cleanup=env.focus();assert.equal(handler(),true);assert.deepEqual(navigated,['/(tabs)']);cleanup();assert.equal(removed,true);
});
