const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureCompatibleGradle, standaloneGradle, standaloneMain } = require('../plugins/withGradleCompatibility');
const fs = require('node:fs');
const vm = require('node:vm');

test('generated Android wrappers meet the minimum without downgrading newer Gradle', () => {
  for (const version of ['8.14.3', '9.3.1', '9.4.0']) {
    const source = `distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-bin.zip\nnetworkTimeout=10000\n`;
    assert.equal(ensureCompatibleGradle(source), source.replace(version, '9.4.1'));
  }
  for (const version of ['9.4.1', '9.4.2', '9.5.0', '10.0.0']) {
    const source = `distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-all.zip\n`;
    assert.equal(ensureCompatibleGradle(source), source);
  }
});

test('prebuild retains Kotlin compatibility and updates the removed ProGuard default', () => {
  const mod = { exports: {} }; const callbacks = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../plugins/withGradleCompatibility'), 'utf8'), {
    module: mod, require: name => name === 'expo/config-plugins' ? {
      withGradleProperties: (config, callback) => { callbacks.properties = callback; return config; },
      withAppBuildGradle: (config, callback) => { callbacks.app = callback; return config; },
      withProjectBuildGradle: (config, callback) => { callbacks.project = callback; return config; },
      withMainApplication: (config, callback) => { callbacks.main = callback; return config; },
      withDangerousMod: config => config,
    } : require(name),
  });
  mod.exports({});
  const project = { modResults: { contents: 'apply plugin: "expo-root-project"' } };
  callbacks.project(project); const once = project.modResults.contents; callbacks.project(project);
  assert.equal(project.modResults.contents, once);
  assert.ok(once.includes('-DCMAKE_OBJECT_PATH_MAX=220'));
  assert.ok(once.includes('buildStagingDirectory'));
  assert.ok(once.indexOf('buildStagingDirectory') < once.indexOf('apply plugin: "expo-root-project"'));
  const properties = { modResults: [{ type: 'property', key: 'android.newDsl', value: 'true' }, { type: 'property', key: 'hermesEnabled', value: 'true' }] };
  callbacks.properties(properties); callbacks.properties(properties);
  for (const key of ['android.builtInKotlin', 'android.newDsl']) {
    const matches = properties.modResults.filter(item => item.key === key);
    assert.equal(matches.length, 1); assert.equal(matches[0].value, 'false');
  }
  assert.equal(properties.modResults.find(item => item.key === 'hermesEnabled').value, 'true');
  const build = { modResults: { contents: 'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"' } };
  callbacks.app(build);
  assert.ok(build.modResults.contents.includes('proguard-android-optimize.txt'));
  assert.ok(build.modResults.contents.includes('"proguard-rules.pro"'));
});

test('standalone device builds embed JavaScript and disable the development server together', () => {
  const gradle = standaloneGradle('react {\n bundleCommand = "export:embed"\n}\nandroid { defaultConfig { } }');
  assert.ok(gradle.includes('debuggableVariants = []'));
  assert.ok(gradle.includes('"CABO_STANDALONE"'));
  assert.equal(standaloneGradle(gradle), gradle);
  const main = standaloneMain('getDefaultReactHost(\n context = applicationContext,\n packageList = packages)');
  assert.ok(main.includes('useDevSupport = BuildConfig.DEBUG && !BuildConfig.CABO_STANDALONE'));
  assert.equal(standaloneMain(main), main);
});
