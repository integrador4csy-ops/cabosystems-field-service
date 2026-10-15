import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(path.join(root, 'src/lib/uiTranslations.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { UI_TRANSLATIONS, translateUiText, interpolate, getRoleLabel, getTaskStatusLabel, getLocale } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const context = ts.createSourceFile('LanguageContext.tsx', readFileSync(path.join(root, 'src/context/LanguageContext.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dictionaries;
function findDictionaries(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(context) === 'WEB_TRANSLATIONS') {
    const object = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
    dictionaries = Object.fromEntries(object.properties.map((language) => [language.name.getText(context), Object.fromEntries(language.initializer.properties.map((entry) => [entry.name.text, entry.initializer.text]))]));
  }
  ts.forEachChild(node, findDictionaries);
}
findDictionaries(context);
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('both languages contain the same named keys', () => {
  assert.deepEqual(Object.keys(dictionaries.es).sort(), Object.keys(dictionaries.en).sort());
});

test('all translations are nonempty and retain every interpolation parameter', () => {
  const pairs = [...Object.entries(UI_TRANSLATIONS), ...Object.keys(dictionaries.es).map((key) => [dictionaries.es[key], dictionaries.en[key]])];
  for (const [spanish, english] of pairs) {
    assert.ok(english.trim(), spanish);
    assert.deepEqual(placeholders(spanish), placeholders(english), spanish);
  }
});

test('all literal translation calls have dictionary entries', () => {
  const missing = [];
  function visitDirectory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visitDirectory(file); continue; }
      if (!/\.tsx?$/.test(file)) continue;
      const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text;
          if (!(key in UI_TRANSLATIONS) && !(key in dictionaries.es)) missing.push(`${path.relative(root, file)}: ${key}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  visitDirectory(path.join(root, 'src'));
  assert.deepEqual(missing, []);
});

test('interpolation preserves task names, addresses, links and literal braces', () => {
  const title = 'Instalar cámaras en Villa 14';
  assert.equal(translateUiText('Más opciones de {value0}', 'en', { value0: title }), `More options for ${title}`);
  assert.equal(translateUiText('Más opciones de {value0}', 'es', { value0: title }), `Más opciones de ${title}`);
  assert.equal(translateUiText('Querencia Villa 14', 'en'), 'Querencia Villa 14');
  assert.equal(interpolate('{link}', { link: 'app://register?token={token}&email=correo@csy.mx' }), 'app://register?token={token}&email=correo@csy.mx');
});

test('roles, task statuses and date locales follow the selected language', () => {
  const english = (key) => translateUiText(key, 'en');
  const spanish = (key) => translateUiText(key, 'es');
  assert.equal(getRoleLabel('aux_instalacion', english), 'Installation assistant');
  assert.equal(getRoleLabel('aux_instalacion', spanish), 'Auxiliar Instalación');
  assert.equal(getTaskStatusLabel('en_proceso', english), 'In progress');
  assert.equal(getTaskStatusLabel('en_proceso', spanish), 'En proceso');
  assert.equal(getLocale('en'), 'en-US');
  assert.equal(getLocale('es'), 'es-MX');
});

test('language selection does not translate navigation identifiers', () => {
  for (const file of ['src/App.tsx', 'src/components/layout/AppSidebar.tsx', 'src/components/team/TeamManagementView.tsx']) {
    const text = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /(?:id:\s*|setActiveItem\()t\(/, file);
    assert.doesNotMatch(text, /\[t\(["']colaboradores/, file);
  }
});
