import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatNotification } from './presentation.ts';

const base = { groupId: 'group-1', messageId: 'message-1', groupName: 'Instalación Villa 01', senderName: 'Carlos', messageType: 'texto', content: 'Ya llegué a la villa.' };

test('older APKs keep normal text delivery and never receive a large image attachment', () => {
  const result = buildChatNotification({ ...base, groupPhotoUrl: 'https://example.com/group.jpg' });
  assert.equal(result.title, base.groupName);
  assert.equal(result.body, 'Carlos: Ya llegué a la villa.');
  assert.equal('richContent' in result, false);
  assert.equal(result.data.url, '/chat/group-1');
  assert.equal(result.threadId, 'chat-group-1');
  assert.equal(result.channelId, 'chat-messages');
  assert.deepEqual(Object.keys(result.data).sort(), ['groupId', 'messageId', 'url']);
});

test('native Android builds receive data-only chat metadata, so FCM cannot render a big picture', () => {
  const result = buildChatNotification({ ...base, platform: 'android', nativeChatVersion: 1, groupPhotoUrl: 'https://example.com/group.jpg', senderId: 'sender-1' });
  for (const key of ['title', 'body', 'channelId', 'icon', 'richContent']) assert.equal(key in result, false);
  assert.equal(result.data.kind, 'chat-message');
  assert.equal(result.data.groupName, base.groupName);
  assert.equal(result.data.senderName, 'Carlos');
  assert.equal(result.data.messageText, base.content);
  assert.equal(result.data.groupPhotoUrl, 'https://example.com/group.jpg');
  assert.equal(result.data.senderId, 'sender-1');
  assert.equal(result.data.messageId, 'message-1');
  assert.equal(result.priority, 'high');
  const ios = buildChatNotification({ ...base, platform: 'ios', nativeChatVersion: 1 });
  assert.equal(ios.title, base.groupName);
});

test('missing or invalid photos preserve a deliverable text notification', () => {
  for (const groupPhotoUrl of [null, '', 'broken', 'file:///group.png', 'http://example.com/image.png', 'https://user:password@example.com/image.jpg']) {
    const result = buildChatNotification({ ...base, groupPhotoUrl });
    assert.equal('richContent' in result, false);
    assert.equal(result.body, 'Carlos: Ya llegué a la villa.');
  }
});

test('attachments have readable previews and retain captions', () => {
  assert.equal(buildChatNotification({ ...base, messageType: 'imagen', content: 'Avance de obra' }).body, 'Carlos: 📷 Foto · Avance de obra');
  assert.equal(buildChatNotification({ ...base, messageType: 'video', content: null }).body, 'Carlos: 🎥 Video');
  assert.equal(buildChatNotification({ ...base, messageType: 'sticker', content: null }).body, 'Carlos: Sticker');
});

test('empty data has fallbacks and long unicode previews fit the push payload', () => {
  const empty = buildChatNotification({ groupId: 'group-1', groupName: ' ', senderName: '', content: '\n' });
  assert.equal(empty.title, 'Chat de Cuadrilla');
  assert.equal(empty.body, 'Compañero de equipo: Nuevo mensaje');
  const long = buildChatNotification({ ...base, content: '👷'.repeat(5000) });
  assert.equal(long.body.endsWith('…'), true);
  assert.equal(Array.from(long.body).length, 248);
  assert.ok(Buffer.byteLength(JSON.stringify(long)) < 4096);
  const native = buildChatNotification({ ...base, groupId: 'x'.repeat(36), platform: 'android', nativeChatVersion: 1, groupName: '👷'.repeat(80), senderName: '👷'.repeat(60), content: '👷'.repeat(5000), groupPhotoUrl: `https://example.com/${'a'.repeat(990)}` });
  assert.ok(Buffer.byteLength(JSON.stringify(native)) < 4096);
});
