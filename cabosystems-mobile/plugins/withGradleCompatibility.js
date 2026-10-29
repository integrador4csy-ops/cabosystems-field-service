const { withDangerousMod, withGradleProperties, withAppBuildGradle, withProjectBuildGradle, withMainApplication } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const nativePaths = `
// CaboSystems: keep native object paths below Windows tool limits.
subprojects { nativeProject ->
  ["com.android.application", "com.android.library"].each { pluginId ->
    nativeProject.plugins.withId(pluginId) {
      if (nativeProject.name == "app") {
        nativeProject.android.defaultConfig.externalNativeBuild.cmake.arguments "-DCMAKE_OBJECT_PATH_MAX=250"
        nativeProject.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir.parentFile.parentFile, ".cxx/" + Integer.toHexString(nativeProject.name.hashCode()))
      } else {
      nativeProject.android.defaultConfig.externalNativeBuild.cmake.arguments "-DCMAKE_OBJECT_PATH_MAX=220"
      nativeProject.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir.parentFile, ".cxx/" + Integer.toHexString(nativeProject.name.hashCode()))
      }
    }
  }
}
`;

// The Android plugin shipped with the current React Native requires 9.4.1.
// Native folders are generated, so preserve this minimum across clean prebuilds.
function ensureCompatibleGradle(properties) {
  return properties.replace(/(distributionUrl=.*gradle-)(\d+)\.(\d+)\.(\d+)(-(?:bin|all)\.zip)/, (line, prefix, major, minor, patch, suffix) => {
    const version = [major, minor, patch].map(Number);
    const minimum = [9, 4, 1];
    const difference = version.findIndex((value, index) => value !== minimum[index]);
    return difference >= 0 && version[difference] < minimum[difference] ? `${prefix}9.4.1${suffix}` : line;
  });
}

function standaloneGradle(source) {
  if (source.includes('CABO_STANDALONE')) return source;
  return source.replace('bundleCommand = "export:embed"', 'bundleCommand = "export:embed"\n    if (findProperty("cabosystems.standalone") == "true") { debuggableVariants = [] }')
    .replace('defaultConfig {', 'defaultConfig {\n        buildConfigField "boolean", "CABO_STANDALONE", (findProperty("cabosystems.standalone") ?: "false").toString()');
}
function standaloneMain(source) {
  if (source.includes('BuildConfig.CABO_STANDALONE')) return source;
  return source.replace('context = applicationContext,', 'context = applicationContext,\n      useDevSupport = BuildConfig.DEBUG && !BuildConfig.CABO_STANDALONE,');
}

module.exports = config => {
  config = withMainApplication(config, mod => {
    mod.modResults.contents = standaloneMain(mod.modResults.contents);
    return mod;
  });
  config = withProjectBuildGradle(config, mod => {
    if (!mod.modResults.contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      const anchor = 'apply plugin: "expo-root-project"';
      mod.modResults.contents = mod.modResults.contents.includes(anchor)
        ? mod.modResults.contents.replace(anchor, nativePaths + '\n' + anchor)
        : mod.modResults.contents + nativePaths;
    }
    return mod;
  });
  config = withAppBuildGradle(config, mod => {
    mod.modResults.contents = standaloneGradle(mod.modResults.contents.replaceAll('proguard-android.txt', 'proguard-android-optimize.txt'));
    return mod;
  });
  config = withGradleProperties(config, mod => {
    for (const key of ['android.builtInKotlin', 'android.newDsl']) {
      mod.modResults = mod.modResults.filter(item => item.type !== 'property' || item.key !== key);
      mod.modResults.push({ type: 'property', key, value: 'false' });
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const file = path.join(mod.modRequest.platformProjectRoot, 'gradle/wrapper/gradle-wrapper.properties');
    const previous = await fs.readFile(file, 'utf8');
    const updated = ensureCompatibleGradle(previous);
    if (updated !== previous) await fs.writeFile(file, updated);
    return mod;
  }]);
};
module.exports.ensureCompatibleGradle = ensureCompatibleGradle;
module.exports.standaloneGradle = standaloneGradle;
module.exports.standaloneMain = standaloneMain;
