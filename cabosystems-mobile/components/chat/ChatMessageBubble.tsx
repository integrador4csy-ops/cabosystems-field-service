import React, { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ViewInstance } from 'react-native';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { Pin, Play, CheckCheck, Reply } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import { getEmojiOnlyCount, getEmojiMessageSize } from '@/lib/chatEmoji';
import { shouldCompleteReplyGesture } from '@/lib/chatGestures';
import type { ChatMessage } from '@/types/database';
import type { ChatRect } from '@/lib/chatReactionLayout';
import { FluentEmoji, EmojiText, EmojiOnlyMessage } from './FluentEmoji';
import { ReplyPreview } from './ReplyPreview';

export const ChatMessageBubble = memo(function ChatMessageBubble({ message, userId, pinned, highlighted, selected, onActions, onReply, onReaction, onImage, onJump, onError }: {
  message: ChatMessage; userId: string; pinned: boolean; highlighted: boolean; selected: boolean;
  onActions: (message: ChatMessage, measure: (callback: (rect: ChatRect) => void) => void) => void; onReaction: (id: string, emoji: string) => void;
  onImage: (url: string) => void; onJump: (id: string) => void; onError: () => void;
  onReply: (message: ChatMessage) => void;
}) {
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const isMe = message.remitente_id === userId;
  const count = message.tipo === 'texto' ? getEmojiOnlyCount(message.contenido || '') : 0;
  const noBubble = count > 0 || message.tipo === 'sticker';
  const outgoingColor = isMe && !noBubble ? P.white : P.slate;
  const outgoingText = isMe && !noBubble ? styles.outgoingText : undefined;
  const bubbleRef = useRef<ViewInstance>(null);
  const liveMessageId = useRef(message.id);
  const translateX = useSharedValue(0);
  useLayoutEffect(() => { liveMessageId.current = message.id; cancelAnimation(translateX); translateX.value = 0; }, [message.id, translateX]);
  const measureBubble = useCallback((callback: (rect: ChatRect) => void) => {
    if (liveMessageId.current !== message.id || !bubbleRef.current) { callback({ x: 0, y: 0, width: 0, height: 0 }); return; }
    bubbleRef.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
  }, [message.id]);
  const select = useCallback(() => onActions(message, measureBubble), [message, measureBubble, onActions]);
  const replyIfCurrent = useCallback((id: string) => { if (liveMessageId.current === id) onReply(message); }, [message, onReply]);
  const messageId = message.id;
  const pan = useMemo(() => Gesture.Pan().activeOffsetX(14).failOffsetX(-14).failOffsetY([-12, 12]).maxPointers(1)
    .onUpdate(event => { translateX.value = Math.min(88, Math.max(0, event.translationX)); })
    .onEnd(event => { if (shouldCompleteReplyGesture(event.translationX, event.translationY)) scheduleOnRN(replyIfCurrent, messageId); })
    .onFinalize(() => { translateX.value = withSpring(0, { damping: 24, stiffness: 300 }); }), [translateX, replyIfCurrent, messageId]);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, translateX.value / 60) }));
  const reactions = useMemo(() => {
    const grouped = new Map<string, { count: number; mine: boolean }>();
    for (const reaction of message.reacciones || []) {
      const entry = grouped.get(reaction.emoji) || { count: 0, mine: false };
      entry.count++; entry.mine ||= reaction.profile_id === userId; grouped.set(reaction.emoji, entry);
    }
    return [...grouped.entries()];
  }, [message.reacciones, userId]);
  return <GestureDetector gesture={pan}><View collapsable={false} style={styles.swipeContainer}><Pressable onLongPress={select} delayLongPress={350} style={[styles.swipeContainer, selected && styles.selected]} accessibilityHint={c.actions}
    accessibilityActions={[{ name: 'longpress', label: c.actions }, { name: 'reply', label: c.reply }]}
    onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'reply') onReply(message); else if (event.nativeEvent.actionName === 'longpress') select(); }}>
    <Animated.View pointerEvents="none" style={[styles.replyHint, hintStyle]}><Reply size={20} color={P.slate} /></Animated.View>
    <Animated.View style={[styles.row, isMe ? styles.rowMe : styles.rowOther, swipeStyle]}>
    <View ref={bubbleRef} collapsable={false} style={[styles.message, highlighted && styles.highlight]}>
      <View style={[styles.bubble, isMe ? styles.outgoing : styles.incoming, noBubble && styles.noBubble]}>
        {!isMe ? <Text style={styles.sender}>{message.profiles?.nombre || c.colleague}</Text> : null}
        {message.reply ? <Pressable accessibilityRole="button" accessibilityLabel={c.original} onPress={() => onJump(message.reply!.id)} onLongPress={select} delayLongPress={350} style={styles.quote}><ReplyPreview message={message.reply} userId={userId} outgoing={isMe && !noBubble} /></Pressable> : null}
        {message.tipo === 'imagen' && message.media_url ? <Pressable accessibilityRole="button" accessibilityLabel={c.photo} onPress={() => onImage(message.media_url!)} onLongPress={select} delayLongPress={350}><Image source={{ uri: message.media_url }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" recyclingKey={message.id} /></Pressable> : null}
        {message.tipo === 'sticker' && message.media_url ? <Image source={{ uri: message.media_url }} style={styles.sticker} contentFit="contain" cachePolicy="memory-disk" recyclingKey={message.id} /> : null}
        {message.tipo === 'video' && message.media_url ? <Pressable accessibilityRole="button" accessibilityLabel={c.video} onLongPress={select} delayLongPress={350} onPress={() => { void Linking.openURL(message.media_url!).catch(onError); }} style={styles.video}>
          {message.media_thumbnail_url ? <Image source={{ uri: message.media_thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}<Play size={30} color={P.white} /><Text style={styles.videoLabel}>{c.video}</Text>
        </Pressable> : null}
        {message.contenido ? count ? <EmojiOnlyMessage text={message.contenido} size={getEmojiMessageSize(count)} /> : <EmojiText text={message.contenido} style={[styles.text, outgoingText]} size={20} /> : null}
        <View style={styles.meta}>{pinned ? <Pin size={11} color={outgoingColor} accessibilityLabel={c.pinStatus} /> : null}<Text style={[styles.time, outgoingText]}>{new Date(message.created_at).toLocaleTimeString(language === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>{isMe ? <CheckCheck size={13} color={outgoingColor} /> : null}</View>
      </View>
      {reactions.length ? <View style={styles.reactions}>{reactions.map(([emoji, reaction]) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`${c.react} ${emoji}, ${reaction.count}`} accessibilityState={{ selected: reaction.mine }} onPress={() => onReaction(message.id, emoji)} onLongPress={select} delayLongPress={350} style={[styles.reaction, reaction.mine && styles.myReaction]}><FluentEmoji emoji={emoji} size={20} /><Text style={styles.reactionCount}>{reaction.count}</Text></Pressable>)}</View> : null}
    </View>
    </Animated.View>
  </Pressable></View></GestureDetector>;
});
const styles = StyleSheet.create({
  swipeContainer: { position: 'relative', width: '100%', minHeight: 44 }, selected: { backgroundColor: P.wash, borderRadius: 8 }, replyHint: { position: 'absolute', left: 10, top: '40%' },
  row: { marginVertical: 6, flexDirection: 'row', gap: 4, alignItems: 'flex-start' }, rowMe: { flexDirection: 'row-reverse' }, rowOther: { flexDirection: 'row' }, message: { maxWidth: '82%' }, bubble: { padding: 10, borderRadius: 12, borderWidth: 1, gap: 6 }, incoming: { backgroundColor: P.white, borderColor: P.line, borderTopLeftRadius: 3 }, outgoing: { backgroundColor: P.accent, borderColor: P.accent, borderTopRightRadius: 3 }, noBubble: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0 },
  sender: { fontFamily: 'Outfit_600SemiBold', color: P.slate, fontSize: 12 }, text: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 23, color: P.ink }, meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }, time: { fontFamily: 'Outfit_400Regular', fontSize: 10, color: P.slate }, image: { width: 230, maxWidth: '100%', height: 210, borderRadius: 8 }, sticker: { width: 128, height: 128 }, video: { width: 220, maxWidth: '100%', height: 150, backgroundColor: P.slate, alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden', gap: 10 }, videoLabel: { color: P.white, fontFamily: 'Outfit_500Medium', fontSize: 12 },
  outgoingText: { color: P.white },
  quote: { alignSelf: 'stretch', minWidth: 140 }, options: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }, reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }, reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 32, borderWidth: 1, borderColor: P.line, backgroundColor: P.white, borderRadius: 16 }, myReaction: { borderColor: P.accent }, reactionCount: { color: P.slate, fontSize: 11, fontFamily: 'Outfit_500Medium' }, highlight: { borderWidth: 2, borderColor: P.accent, borderRadius: 14, padding: 2 },
});
