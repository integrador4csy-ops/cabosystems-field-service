import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ViewInstance } from 'react-native';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { Pin, Play, CheckCheck, Reply, Download } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import { getEmojiOnlyCount, getEmojiMessageSize } from '@/lib/chatEmoji';
import { shouldCompleteReplyGesture } from '@/lib/chatGestures';
import { getDocumentInfo } from '@/lib/chatDocumentTypes';
import type { ChatMessage } from '@/types/database';
import type { ChatRect } from '@/lib/chatReactionLayout';
import { FluentEmoji, EmojiText, EmojiOnlyMessage } from './FluentEmoji';
import { ReplyPreview } from './ReplyPreview';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import { ChatVideoPreview } from './ChatVideoPreview';
import { ChatDocumentBadge } from './ChatDocumentBadge';
import { ChatSystemMessage } from './ChatSystemMessage';

function formatVideoDuration(seconds?: number): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({ message, userId, pinned, highlighted, selected, onActions, onReply, onReaction, onImage, onVideo, onDocument, onJump, onError }: {
  message: ChatMessage; userId: string; pinned: boolean; highlighted: boolean; selected: boolean;
  onActions: (message: ChatMessage, measure: (callback: (rect: ChatRect) => void) => void) => void; onReaction: (id: string, emoji: string) => void;
  onImage: (url: string) => void; onVideo?: (url: string, meta?: ChatMessage['media_meta'], title?: string) => void;
  onDocument?: (url: string, meta?: ChatMessage['media_meta'], title?: string) => void;
  onJump: (id: string) => void; onError: () => void;
  onReply: (message: ChatMessage) => void;
}) {
  const { t: tr } = useInterfaceTranslation();
  if (message.tipo === 'sistema') {
    return <ChatSystemMessage message={message} onImage={onImage} />;
  }
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const isMe = message.remitente_id === userId;
  const count = message.tipo === 'texto' ? getEmojiOnlyCount(message.contenido || '') : 0;
  const noBubble = !message.reply && (count > 0 || message.tipo === 'sticker');
  const isDocument = message.tipo === 'archivo';
  const outgoingColor = isMe && !noBubble && !isDocument ? P.white : P.slate;
  const outgoingText = isMe && !noBubble && !isDocument ? styles.outgoingText : undefined;
  const docInfo = useMemo(() => (message.tipo === 'archivo' ? getDocumentInfo(message.media_meta?.fileName, message.media_meta?.mimeType, message.media_url) : null), [message.tipo, message.media_meta, message.media_url]);
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
      <View style={[styles.bubble, isMe ? styles.outgoing : styles.incoming, noBubble && styles.noBubble, isDocument && styles.documentBubble, message.reply && styles.replyBubble, reactions.length > 0 && !noBubble && { paddingBottom: 14 }]}>
        {!isMe ? <Text style={styles.sender}>{message.profiles?.nombre || c.colleague}</Text> : null}
        {message.reply ? <Pressable accessibilityRole="button" accessibilityLabel={c.original} onPress={() => onJump(message.reply!.id)} onLongPress={select} delayLongPress={350} style={styles.quote}><ReplyPreview message={message.reply} userId={userId} outgoing={isMe && !noBubble && !isDocument} /></Pressable> : null}
        {message.tipo === 'imagen' && message.media_url ? <Pressable accessibilityRole="button" accessibilityLabel={c.photo} onPress={() => onImage(message.media_url!)} onLongPress={select} delayLongPress={350}><Image source={{ uri: message.media_url }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" recyclingKey={message.id} /></Pressable> : null}
        {message.tipo === 'sticker' && message.media_url ? <Image source={{ uri: message.media_url }} style={styles.sticker} contentFit="contain" cachePolicy="memory-disk" recyclingKey={message.id} /> : null}
        {message.tipo === 'video' && message.media_url ? <Pressable accessibilityRole="button" accessibilityLabel={`${c.video}${message.media_meta?.duration ? `, ${formatVideoDuration(message.media_meta.duration)}` : ''}`} onLongPress={select} delayLongPress={350} onPress={() => { if (onVideo) { onVideo(message.media_url!, message.media_meta, message.profiles?.nombre ? tr('Video de {value0}', {value0: message.profiles.nombre}) : undefined); } else { void Linking.openURL(message.media_url!).catch(onError); } }} style={styles.video}>
          <ChatVideoPreview url={message.media_url!} thumbnailUrl={message.media_thumbnail_url} />
          <View style={styles.videoPlayBadge}><Play size={20} color={P.white} fill={P.white} /></View>
          <View style={styles.videoMetaPill}><Text style={styles.videoMetaText}>{message.media_meta?.duration ? `${formatVideoDuration(message.media_meta.duration)} · ${c.video}` : c.video}</Text></View>
        </Pressable> : null}
        {message.tipo === 'audio' && message.media_url ? <ChatAudioPlayer key={message.id} uri={message.media_url} duration={message.media_meta?.duration} outgoing={isMe} label={c.audio} onError={onError} /> : null}
        {message.tipo === 'archivo' && message.media_url && docInfo ? (
          <View style={styles.documentCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${tr(docInfo.typeName)}: ${message.media_meta?.fileName || c.document}`}
              onLongPress={select}
              delayLongPress={350}
              onPress={() => {
                if (onDocument) {
                  onDocument(message.media_url!, message.media_meta, message.media_meta?.fileName || message.contenido || tr(docInfo.typeName));
                } else {
                  void Linking.openURL(message.media_url!).catch(onError);
                }
              }}
              style={styles.documentTopRow}
            >
              <ChatDocumentBadge info={docInfo} size={42} />
              <View style={styles.documentBody}>
                <Text style={styles.documentFileName} numberOfLines={1} ellipsizeMode="middle">
                  {message.media_meta?.fileName || message.contenido || c.document}
                </Text>
                <View style={styles.documentMetaRow}>
                  <Text style={styles.documentMetaText}>
                    {message.media_meta?.fileSize
                      ? (message.media_meta.fileSize > 1024 * 1024
                          ? (message.media_meta.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                          : (message.media_meta.fileSize / 1024).toFixed(0) + ' KB')
                      : docInfo.badgeLabel}
                  </Text>
                  <Text style={styles.documentDot}>•</Text>
                  <Text style={styles.documentTypeLabel} numberOfLines={1} ellipsizeMode="tail">
                    {tr(docInfo.typeName)}
                  </Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.documentDivider} />

            <View style={styles.documentActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.preview || tr("Vista previa")}
                onPress={() => {
                  if (onDocument) {
                    onDocument(message.media_url!, message.media_meta, message.media_meta?.fileName || message.contenido || tr(docInfo.typeName));
                  } else {
                    void Linking.openURL(message.media_url!).catch(onError);
                  }
                }}
                style={({ pressed }) => [styles.docPreviewBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.docPreviewBtnText}>
                  {c.preview || tr("Vista previa")}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.download || tr("Descargar archivo")}
                onPress={() => {
                  void Linking.openURL(message.media_url!).catch(onError);
                }}
                style={({ pressed }) => [styles.docDownloadBtn, pressed && { opacity: 0.8 }]}
              >
                <Download size={14} color={P.slate} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {message.contenido && message.tipo !== 'archivo' ? count ? <EmojiOnlyMessage text={message.contenido} size={getEmojiMessageSize(count)} /> : <EmojiText text={message.contenido} style={[styles.text, outgoingText]} size={20} /> : null}
        <View style={styles.meta}>{pinned ? <Pin size={11} color={outgoingColor} accessibilityLabel={c.pinStatus} /> : null}<Text style={[styles.time, outgoingText]}>{new Date(message.created_at).toLocaleTimeString(language === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>{isMe ? <CheckCheck size={13} color={isDocument ? P.accent : outgoingColor} /> : null}</View>
        {reactions.length ? <View style={[styles.reactions, isMe ? styles.reactionsMe : styles.reactionsOther]}><View style={styles.reactionsBubble}>{reactions.map(([emoji, reaction]) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`${c.react} ${emoji}, ${reaction.count}`} accessibilityState={{ selected: reaction.mine }} onPress={() => onReaction(message.id, emoji)} onLongPress={select} delayLongPress={350} style={[styles.reaction, reaction.mine && styles.myReaction]}><FluentEmoji emoji={emoji} size={19} />{reaction.count > 1 ? <Text style={styles.reactionCount}>{reaction.count}</Text> : null}</Pressable>)}</View></View> : null}
      </View>
    </View>
    </Animated.View>
  </Pressable></View></GestureDetector>;
});
const styles = StyleSheet.create({
  document: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160, maxWidth: '100%', minHeight: 52 },
  documentBubble: { backgroundColor: P.white, borderColor: P.line, borderTopRightRadius: 12, borderTopLeftRadius: 12 },
  documentCard: { width: 226, maxWidth: '100%' },
  documentTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  documentFileName: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, lineHeight: 17, color: P.ink },
  documentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexShrink: 1, overflow: 'hidden' },
  documentMetaText: { fontFamily: 'Outfit_500Medium', fontSize: 10, color: P.slate, flexShrink: 0 },
  documentDot: { fontSize: 9, color: P.slate, flexShrink: 0 },
  documentTypeLabel: { fontFamily: 'Outfit_400Regular', fontSize: 10, color: P.slate, flexShrink: 1 },
  documentBody: { flex: 1, minWidth: 0, justifyContent: 'center', overflow: 'hidden' },
  documentDivider: { height: 1, backgroundColor: P.line, marginTop: 8, marginBottom: 6 },
  documentActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docPreviewBtn: { flex: 1, height: 30, borderRadius: 7, backgroundColor: 'rgba(52, 62, 72, 0.04)', alignItems: 'center', justifyContent: 'center' },
  docPreviewBtnText: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: P.slate },
  docDownloadBtn: { width: 30, height: 30, borderRadius: 7, backgroundColor: 'rgba(52, 62, 72, 0.04)', alignItems: 'center', justifyContent: 'center' },
  swipeContainer: { position: 'relative', width: '100%', minHeight: 44 }, selected: { backgroundColor: P.wash, borderRadius: 8 }, replyHint: { position: 'absolute', left: 10, top: '40%' },
  row: { marginVertical: 6, marginBottom: 10, flexDirection: 'row', gap: 4, alignItems: 'flex-start' }, rowMe: { flexDirection: 'row-reverse' }, rowOther: { flexDirection: 'row' }, message: { maxWidth: '82%', position: 'relative' }, bubble: { padding: 10, borderRadius: 12, borderWidth: 1, gap: 6, position: 'relative' }, incoming: { backgroundColor: P.white, borderColor: P.line, borderTopLeftRadius: 3 }, outgoing: { backgroundColor: P.accent, borderColor: P.accent, borderTopRightRadius: 3 }, noBubble: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0 },
  sender: { fontFamily: 'Outfit_600SemiBold', color: P.slate, fontSize: 12 }, text: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 23, color: P.ink }, meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4, marginLeft: 12 }, time: { fontFamily: 'Outfit_400Regular', fontSize: 10, color: P.slate }, image: { width: 230, maxWidth: '100%', height: 210, borderRadius: 8 }, sticker: { width: 128, height: 128 },
  video: { width: 226, maxWidth: '100%', height: 154, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden', position: 'relative' },
  videoPlayBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(247, 140, 38, 0.94)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 3 },
  videoMetaPill: { position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(15, 23, 42, 0.76)' },
  videoMetaText: { color: P.white, fontFamily: 'Outfit_500Medium', fontSize: 10 },
  outgoingText: { color: P.white },
  replyBubble: { padding: 5, gap: 8 }, quote: { alignSelf: 'stretch', minWidth: 140 }, options: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  reactions: { position: 'absolute', bottom: -14, zIndex: 10 },
  reactionsMe: { left: 8 },
  reactionsOther: { left: 8 },
  reactionsBubble: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6, minWidth: 32, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1.5 }, shadowOpacity: 0.12, shadowRadius: 2.5, elevation: 3 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  myReaction: { transform: [{ scale: 1.05 }] },
  reactionCount: { color: P.slate, fontSize: 11, fontFamily: 'Outfit_600SemiBold' }, highlight: { borderWidth: 2, borderColor: P.accent, borderRadius: 14, padding: 2 },
});
