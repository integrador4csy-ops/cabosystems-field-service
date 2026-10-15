import React, { memo, useMemo, useState } from 'react';
import { Text, View, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { FLUENT_EMOJI_ASSETS } from '@/lib/fluentEmojiAssets';
import { emojiToCode, splitEmojiText } from '@/lib/chatEmoji';
import { getPreparedEmoji } from '@/lib/chatMediaWarmup';

export const FluentEmoji = memo(function FluentEmoji({ emoji, size = 24 }: { emoji: string; size?: number }) {
  const source = FLUENT_EMOJI_ASSETS[emojiToCode(emoji)];
  const [failed, setFailed] = useState<number | null>(null);
  return source && source !== failed
    ? <Image source={(size <= 32 && getPreparedEmoji(emoji)) || source} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={emoji} accessibilityLabel={emoji} onError={() => setFailed(source)} />
    : <Text style={{ fontSize: size, lineHeight: size * 1.25 }} accessibilityLabel={emoji}>{emoji}</Text>;
});

/** RN Text supports inline images; preserve wrapping instead of splitting sentences into Views. */
export const EmojiText = memo(function EmojiText({ text, size = 20, style }: { text: string; size?: number; style?: StyleProp<TextStyle> }) {
  const parts = useMemo(() => splitEmojiText(text), [text]);
  return <Text style={style}>{parts.map((part, index) => {
    const source = part.type === 'emoji' ? FLUENT_EMOJI_ASSETS[emojiToCode(part.value)] : undefined;
    return source ? <Image key={`${index}-${part.value}`} source={source} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={part.value} /> : part.value;
  })}</Text>;
});

export function EmojiOnlyMessage({ text, size }: { text: string; size: number }) {
  const parts = useMemo(() => splitEmojiText(text).filter((part) => part.type === 'emoji'), [text]);
  return <View style={styles.emojiLine} accessibilityLabel={text}>{parts.map((part, index) => <FluentEmoji key={`${index}-${part.value}`} emoji={part.value} size={size} />)}</View>;
}
const styles = StyleSheet.create({ emojiLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingVertical: 4 } });
