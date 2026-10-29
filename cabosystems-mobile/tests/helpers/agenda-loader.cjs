const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
module.exports = function createLoader(overrides = {}, globals = {}) {
  const modules = new Map();
  const root = path.resolve(__dirname, '../../lib');
  function load(file) {
    const absolute = path.resolve(root, file.endsWith('.ts') ? file : `${file}.ts`);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const module = { exports: {} }; modules.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports: module.exports, module, Date, Map, Set, Promise, setTimeout, clearTimeout, ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), name)));
        throw Error(`Unexpected dependency ${name}`);
      },
    });
    return module.exports;
  }
  return load;
};
