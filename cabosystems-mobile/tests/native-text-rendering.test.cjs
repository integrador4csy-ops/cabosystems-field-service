const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Inspect emitted children: JSX preserves spaces on a single line, even when
// those spaces look like harmless indentation before a comment.
test('native containers never receive literal text children', () => {
  const violations = [];
  const containers = new Set(['View', 'Animated.View', 'Pressable', 'ScrollView', 'SafeAreaView', 'TouchableOpacity']);
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { scan(filename); continue; }
      if (!filename.endsWith('.tsx')) continue;
      const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const source = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'React.createElement' &&
            node.arguments[0] && containers.has(node.arguments[0].getText(source))) {
          for (const child of node.arguments.slice(2)) {
            if ((ts.isStringLiteral(child) && child.text.length > 0) || ts.isNumericLiteral(child)) {
              violations.push(`${path.relative(path.join(__dirname, '..'), filename)}: ${child.getText(source)}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(path.join(__dirname, '../app'));
  scan(path.join(__dirname, '../components'));
  assert.deepEqual(violations, [], 'Wrap literal text in <Text>, including inline whitespace');
});
