// Apply the same Expo plugin to an already-generated local Android checkout.
const path = require('node:path');
const fs = require('node:fs/promises');
const { AndroidConfig } = require('expo/config-plugins');
const { configureManifest, writeNativeSource } = require('../plugins/withChatNotifications');

async function main() {
  const androidRoot = path.resolve(__dirname, '../android');
  const manifestPath = path.join(androidRoot, 'app/src/main/AndroidManifest.xml');
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, configureManifest(manifest));
  await writeNativeSource(androidRoot);
  const gradlePath = path.join(androidRoot, 'app/build.gradle');
  const gradle = await fs.readFile(gradlePath, 'utf8');
  const version = require('../app.json').expo.android.versionCode;
  await fs.writeFile(gradlePath, gradle.replace(/versionCode \d+/, `versionCode ${version}`));
  console.log('Native chat notification plugin applied.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
