interface ChatNotificationInput {
  groupId: string;
  messageId?: string;
  groupName?: string | null;
  groupPhotoUrl?: string | null;
  senderName?: string | null;
  senderId?: string;
  messageType?: string;
  content?: string | null;
  platform?: string;
  nativeChatVersion?: number;
}

function compactText(text: string, limit: number): string {
  const characters = Array.from(text.replace(/\s+/g, ' ').trim());
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : characters.join('');
}

function photoUrl(value?: string | null): string | undefined {
  if (!value || value.length > 1024) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Avatars are metadata, never richContent images (FCM expands those as attachments). */
export function buildChatNotification(input: ChatNotificationInput) {
  const groupName = compactText(input.groupName || '', 80) || 'Chat de Cuadrilla';
  const senderName = compactText(input.senderName || '', 60) || 'Compañero de equipo';
  const content = compactText(input.content || '', 240);
  const attachment = ({ imagen: '📷 Foto', video: '🎥 Video', sticker: 'Sticker' } as Record<string, string>)[input.messageType || 'texto'];
  const preview = attachment ? `${attachment}${content ? ` · ${content}` : ''}` : content || 'Nuevo mensaje';
  const image = photoUrl(input.groupPhotoUrl);
  const data = {
    kind: 'chat-message',
    groupId: input.groupId,
    messageId: input.messageId,
    url: `/chat/${input.groupId}`,
    groupName,
    groupPhotoUrl: image || null,
    senderName,
    senderId: input.senderId,
    messageText: preview,
  };
  // Only a confirmed native build may receive data-only pushes. Older APKs retain
  // normal text delivery, so installing the new version is never a prerequisite.
  if (input.platform === 'android' && (input.nativeChatVersion || 0) >= 1) {
    return { data, priority: 'high' as const, ttl: 86400 };
  }
  return {
    sound: 'default' as const,
    title: groupName,
    body: `${senderName}: ${preview}`,
    threadId: `chat-${input.groupId}`,
    data: { groupId: input.groupId, messageId: input.messageId, url: `/chat/${input.groupId}` },
    channelId: 'chat-messages',
    priority: 'high' as const,
  };
}
