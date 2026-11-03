const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
test('memo and effect callbacks do not call React hooks', () => {
 const violations = [];
 function scan(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
   const file = path.join(dir, entry.name);
   if (entry.isDirectory()) { scan(file); continue; }
   if (!/\.tsx?$/.test(file)) continue;
   const source = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
   function visit(node) {
    if (ts.isCallExpression(node) && /^(React\.)?use(Memo|Effect|LayoutEffect)$/.test(node.expression.getText(source))) {
     const callback = node.arguments[0];
     if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      function check(child) {
       if (ts.isCallExpression(child) && /^(React\.)?use[A-Z]/.test(child.expression.getText(source))) {
        const line = source.getLineAndCharacterOfPosition(child.getStart()).line + 1;
        violations.push(file + ':' + line + ' ' + child.expression.getText(source));
       }
       ts.forEachChild(child, check);
      }
      check(callback.body);
     }
    }
    ts.forEachChild(node, visit);
   }
   visit(source);
  }
 }
 for (const dir of ['app','components','lib']) scan(path.join(__dirname,'..',dir));
 assert.deepEqual(violations, []);
});
