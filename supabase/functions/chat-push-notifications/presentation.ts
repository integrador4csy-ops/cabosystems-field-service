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
  taskId?: string | null;
  subtaskId?: string | null;
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
  const isSystemTaskActivity = input.messageType === 'sistema';
  const groupName = compactText(input.groupName || '', 80) || (isSystemTaskActivity ? 'Avance de Cuadrilla' : 'Chat de Cuadrilla');
  const senderName = compactText(input.senderName || '', 60) || 'Compañero de equipo';
  const content = compactText(input.content || '', 240);
  const attachment = ({ imagen: '📷 Foto', video: '🎥 Video', sticker: 'Sticker' } as Record<string, string>)[input.messageType || 'texto'];
  const preview = attachment ? `${attachment}${content ? ` · ${content}` : ''}` : content || (isSystemTaskActivity ? 'Nuevo avance de tarea' : 'Nuevo mensaje');
  const image = photoUrl(input.groupPhotoUrl);

  const title = isSystemTaskActivity ? `${groupName} · Avance de tarea` : groupName;
  const body = isSystemTaskActivity ? preview : `${senderName}: ${preview}`;

  const data: Record<string, any> = {
    kind: isSystemTaskActivity ? 'task_activity' : 'chat-message',
    groupId: input.groupId,
    messageId: input.messageId,
    url: `/chat/${input.groupId}`,
    groupName,
    groupPhotoUrl: image || null,
    senderName,
    senderId: input.senderId,
    messageText: preview,
  };

  if (input.taskId) {
    data.taskId = input.taskId;
  }
  if (input.subtaskId) {
    data.subtaskId = input.subtaskId;
  }

  // Only a confirmed native build may receive data-only pushes. Older APKs retain
  // normal text delivery, so installing the new version is never a prerequisite.
  if (input.platform === 'android' && (input.nativeChatVersion || 0) >= 1) {
    return { data, priority: 'high' as const, ttl: 86400 };
  }

  const legacyData: Record<string, any> = {
    groupId: input.groupId,
    messageId: input.messageId,
    url: `/chat/${input.groupId}`,
  };
  if (input.taskId) legacyData.taskId = input.taskId;
  if (input.subtaskId) legacyData.subtaskId = input.subtaskId;
  if (isSystemTaskActivity) legacyData.kind = 'task_activity';

  return {
    sound: 'default' as const,
    title,
    body,
    threadId: `chat-${input.groupId}`,
    data: legacyData,
    channelId: 'chat-messages',
    priority: 'high' as const,
  };
}
