import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/types/database';
import { EmojiText } from './FluentEmoji';

export function ReplyPreview({ message, userId }: { message: ChatMessage; userId: string }) {
  const { language } = useTranslation();
  const c = CHAT_COPY[language];
  return <View style={styles.box}>
    <View style={styles.content}><Text numberOfLines={1} style={styles.name}>{message.remitente_id === userId ? c.you : message.profiles?.nombre || c.colleague}</Text>
      <View style={styles.snippet}><EmojiText text={(message.contenido || (message.tipo === 'video' ? c.video : message.tipo === 'sticker' ? c.sticker : c.photo)).replace(/\s+/g, ' ').slice(0, 100)} size={15} style={styles.text} /></View>
    </View>
    {(message.media_thumbnail_url || (message.tipo === 'imagen' && message.media_url)) ? <Image source={{ uri: message.media_thumbnail_url || message.media_url! }} style={styles.image} contentFit="cover" /> : null}
  </View>;
}
const styles = StyleSheet.create({ box: { borderLeftWidth: 3, borderLeftColor: P.accent, borderRadius: 6, backgroundColor: P.wash, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }, content: { flex: 1, minWidth: 0 }, name: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: P.slate, marginBottom: 3 }, text: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17, color: P.muted }, snippet: { maxHeight: 36, overflow: 'hidden' }, image: { width: 36, height: 36, borderRadius: 4 } });
