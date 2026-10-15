import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard, useWindowDimensions } from 'react-native';
import { Smile, Sticker, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import EmojiPicker from './EmojiPicker';
import StickerPicker from './StickerPicker';

export function ComposerMediaPanel({ userId, textBlocked, sending, onEmoji, onSticker, onClose }: {
  userId: string; textBlocked: boolean; sending: boolean; onEmoji: (emoji: string) => void; onSticker: (url: string) => void; onClose: () => void;
}) {
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const { height } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'emoji' | 'stickers'>(textBlocked ? 'stickers' : 'emoji');
  const [keyboardHeight, setKeyboardHeight] = useState(Keyboard.metrics()?.height || 0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Reserve the header, composer, tabs and a small portion of the conversation.
  // Search, section title and categories also need room for at least one emoji row.
  const searchSpace = height - keyboardHeight - insets.top - insets.bottom - (60 + 54 + 56 + 48);
  const contentHeight = keyboardHeight ? Math.min(340, Math.max(220, searchSpace)) : Math.min(340, Math.max(144, height * 0.40));
  return <View style={[styles.panel, { paddingBottom: Math.max(8, insets.bottom) }]}>
    <View style={styles.tabs} accessibilityRole="tablist">
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'emoji', disabled: textBlocked }} accessibilityLabel={c.emojiTab} disabled={textBlocked} onPress={() => { Keyboard.dismiss(); setTab('emoji'); }} style={[styles.tab, tab === 'emoji' && styles.active]}><Smile size={20} color={tab === 'emoji' ? P.accent : P.muted} /><Text style={[styles.label, tab === 'emoji' && styles.activeLabel]}>{c.emojiTab}</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'stickers' }} accessibilityLabel={c.stickerTab} onPress={() => { Keyboard.dismiss(); setTab('stickers'); }} style={[styles.tab, tab === 'stickers' && styles.active]}><Sticker size={20} color={tab === 'stickers' ? P.accent : P.muted} /><Text style={[styles.label, tab === 'stickers' && styles.activeLabel]}>{c.stickerTab}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.close} style={styles.close} onPress={onClose}><ChevronDown size={22} color={P.slate} /></Pressable>
    </View>
    <View style={{ height: contentHeight }}>
      {!textBlocked ? <View style={[StyleSheet.absoluteFill, tab !== 'emoji' && styles.inactive]} pointerEvents={tab === 'emoji' ? 'auto' : 'none'} accessibilityElementsHidden={tab !== 'emoji'} importantForAccessibility={tab === 'emoji' ? 'auto' : 'no-hide-descendants'}><EmojiPicker onSelect={onEmoji} height={contentHeight} categoriesPlacement="bottom" disabled={sending} /></View> : null}
      <View style={[StyleSheet.absoluteFill, tab !== 'stickers' && !textBlocked && styles.inactive]} pointerEvents={tab === 'stickers' || textBlocked ? 'auto' : 'none'} accessibilityElementsHidden={tab !== 'stickers' && !textBlocked} importantForAccessibility={tab === 'stickers' || textBlocked ? 'auto' : 'no-hide-descendants'}><StickerPicker userId={userId} onSelect={onSticker} disabled={sending} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  inactive: { opacity: 0 },
  panel: { borderTopWidth: 1, borderColor: P.line, paddingHorizontal: 12, backgroundColor: P.white }, tabs: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, tab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' }, active: { borderBottomColor: P.accent }, label: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: P.muted }, activeLabel: { color: P.slate }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, loading: { flex: 1 },
});
