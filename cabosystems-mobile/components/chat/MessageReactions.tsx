import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import { getReactionBarLayout, type ChatRect } from '@/lib/chatReactionLayout';
import { FluentEmoji } from './FluentEmoji';

const quick = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
export function MessageReactions({ anchor, viewport, root, outgoing, onReact, onMore }: {
  anchor: ChatRect; viewport: ChatRect; root: ChatRect; outgoing: boolean; onReact: (emoji: string) => void; onMore: () => void;
}) {
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const position = getReactionBarLayout(anchor, viewport, root, outgoing);
  if (!position) return null;
  return <View style={[styles.bar, position]} accessibilityLabel={c.quick}>
    {quick.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`${c.react} ${emoji}`} onPress={() => onReact(emoji)} style={styles.button}><FluentEmoji emoji={emoji} size={29} /></Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel={c.more} onPress={onMore} style={styles.button}><Plus size={23} color={P.slate} /></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  bar: { position: 'absolute', zIndex: 30, elevation: 8, height: 52, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 26, borderWidth: 1, borderColor: P.line, backgroundColor: P.white, shadowColor: P.ink, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  button: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
});
