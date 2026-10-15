const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const receiver = 'com.cabosystems.fieldservice.notifications.ChatNotificationsService';
const expoReceiver = 'expo.modules.notifications.service.NotificationsService';

function configureManifest(manifest) {
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.receiver = (app.receiver || []).filter((item) => ![receiver, expoReceiver].includes(item.$['android:name']));
  app.receiver.push({ $: { 'android:name': expoReceiver, 'tools:node': 'remove' } });
  app.receiver.push({
    $: { 'android:name': receiver, 'android:enabled': 'true', 'android:exported': 'false' },
    'intent-filter': [{ $: { 'android:priority': '1' }, action: [
      'expo.modules.notifications.NOTIFICATION_EVENT', 'android.intent.action.BOOT_COMPLETED',
      'android.intent.action.REBOOT', 'android.intent.action.QUICKBOOT_POWERON',
      'com.htc.intent.action.QUICKBOOT_POWERON', 'android.intent.action.MY_PACKAGE_REPLACED',
    ].map((name) => ({ $: { 'android:name': name } })) }],
  });
  return manifest;
}

async function writeNativeSource(androidRoot) {
  const destination = path.join(androidRoot, 'app/src/main/java/com/cabosystems/fieldservice/notifications');
  await fs.mkdir(destination, { recursive: true });
  await fs.copyFile(path.join(__dirname, 'chat-notifications/ChatNotificationsService.kt'), path.join(destination, 'ChatNotificationsService.kt'));
}

function withChatNotifications(config) {
  config = withAndroidManifest(config, (mod) => { mod.modResults = configureManifest(mod.modResults); return mod; });
  return withDangerousMod(config, ['android', async (mod) => { await writeNativeSource(mod.modRequest.platformProjectRoot); return mod; }]);
}

module.exports = withChatNotifications;
module.exports.configureManifest = configureManifest;
module.exports.writeNativeSource = writeNativeSource;
