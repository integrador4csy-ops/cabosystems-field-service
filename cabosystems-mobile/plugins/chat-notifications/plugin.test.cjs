const assert = require('node:assert/strict');
const test = require('node:test');
const { configureManifest } = require('../withChatNotifications');

test('chat receiver replaces Expo exactly once and preserves other receivers', () => {
  const manifest = { manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' }, receiver: [{ $: { 'android:name': 'OtherReceiver' } }] }] } };
  configureManifest(manifest);
  configureManifest(manifest);
  const receivers = manifest.manifest.application[0].receiver;
  assert.equal(receivers.length, 3);
  assert.ok(receivers.some((item) => item.$['android:name'] === 'OtherReceiver'));
  const removed = receivers.find((item) => item.$['android:name'] === 'expo.modules.notifications.service.NotificationsService');
  assert.equal(removed.$['tools:node'], 'remove');
  const chat = receivers.find((item) => item.$['android:name'].endsWith('ChatNotificationsService'));
  assert.equal(chat.$['android:exported'], 'false');
  const actions = chat['intent-filter'][0].action.map((item) => item.$['android:name']);
  assert.ok(actions.includes('expo.modules.notifications.NOTIFICATION_EVENT'));
  assert.ok(actions.includes('android.intent.action.BOOT_COMPLETED'));
  assert.ok(actions.includes('android.intent.action.MY_PACKAGE_REPLACED'));
});
