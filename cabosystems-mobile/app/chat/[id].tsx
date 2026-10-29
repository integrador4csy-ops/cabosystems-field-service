import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewInstance, TextInputInstance } from 'react-native';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, ActivityIndicator, KeyboardAvoidingView, Keyboard, Platform, BackHandler, useWindowDimensions } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { ArrowLeft, Info, Send, Camera, Paperclip, Keyboard as KeyboardIcon, Smile, X, Reply, Pin, PinOff, Copy, Trash2, MoreVertical, ChevronDown } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { captureImageSafe, pickImageSafe } from '@/lib/mediaPicker';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { CHAT_COPY } from '@/lib/chatCopy';
import { insertEmoji } from '@/lib/chatEmoji';
import { supabase } from '@/lib/supabase';
import { getChatGroupDetails, getGroupMessages, getChatMessage, sendChatMessage, toggleChatReaction, getChatPins, pinChatMessage, unpinChatMessage, deleteChatMessage } from '@/lib/chatApi';
import type { ChatGroup, ChatMessage, ChatMessageType, ChatPin } from '@/types/database';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatToolsModal, type ChatToolTarget } from '@/components/chat/ChatToolsModal';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { MessageReactions } from '@/components/chat/MessageReactions';
import { ComposerMediaPanel } from '@/components/chat/ComposerMediaPanel';
import type { ChatRect } from '@/lib/chatReactionLayout';
import { prepareChatEmojis } from '@/lib/chatMediaWarmup';
import { stickerLibrary } from '@/lib/stickerLibrary';

const messageKey = (message: ChatMessage) => message.id;
const messageType = (message: ChatMessage) => message.tipo;

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets(); const { profile } = useAuth();
  const dimensions = useWindowDimensions();
  const userId = profile?.id || ''; const { language } = useTranslation(); const c = CHAT_COPY[language];
  useEffect(() => {
    if (!userId) return;
    void stickerLibrary.prepare(userId);
    const idle = requestIdleCallback(() => { void prepareChatEmojis(); }, { timeout: 750 });
    return () => cancelIdleCallback(idle);
  }, [userId]);
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pins, setPins] = useState<ChatPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tools, setTools] = useState<ChatToolTarget | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [mediaPanelReady, setMediaPanelReady] = useState(false);
  useEffect(() => {
    if (!group?.id) return;
    const idle = requestIdleCallback(() => setMediaPanelReady(true), { timeout: 750 });
    return () => cancelIdleCallback(idle);
  }, [group?.id, userId]);
  const [reactionAnchor, setReactionAnchor] = useState<(ChatRect & { id: string }) | null>(null);
  const [rootBounds, setRootBounds] = useState<ChatRect | null>(null);
  const [feedBounds, setFeedBounds] = useState<ChatRect | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const rootRef = useRef<ViewInstance>(null);
  const feedRef = useRef<ViewInstance>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selectedMeasure = useRef<((callback: (rect: ChatRect) => void) => void) | null>(null);
  const anchorFrame = useRef<number | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const sendLock = useRef(false); const activeRoom = useRef(id);
  const sendSequence = useRef(0);
  const errorCopy = useRef(c.failed);
  useEffect(() => { errorCopy.current = c.failed; }, [c.failed]);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = messages.find((message) => message.id === selectedId) || null;
  const feedExtra = useMemo(() => ({ selectedId, highlighted, pinnedIds: pins }), [selectedId, highlighted, pins]);
  const measureSelection = useCallback(() => {
    if (anchorFrame.current !== null || !selectedIdRef.current) return;
    anchorFrame.current = requestAnimationFrame(() => {
      anchorFrame.current = null;
      const selectedMessageId = selectedIdRef.current;
      selectedMeasure.current?.((rect) => {
        if (!selectedMessageId || selectedIdRef.current !== selectedMessageId) return;
        setReactionAnchor((prev) => rect.width <= 0 || rect.height <= 0 ? null : prev?.id === selectedMessageId && prev.x === rect.x && prev.y === rect.y && prev.width === rect.width && prev.height === rect.height ? prev : { ...rect, id: selectedMessageId });
      });
    });
  }, []);
  const measureBounds = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => setRootBounds({ x, y, width, height }));
    feedRef.current?.measureInWindow((x, y, width, height) => setFeedBounds({ x, y, width, height }));
    measureSelection();
  }, [measureSelection]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) { setReactionAnchor(null); selectedMeasure.current = null; }
  }, [selectedId]);
  useEffect(() => { measureBounds(); }, [dimensions.width, dimensions.height, measureBounds]);
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', measureBounds);
    const shown = Keyboard.addListener('keyboardDidShow', measureBounds);
    return () => { hidden.remove(); shown.remove(); if (anchorFrame.current !== null) cancelAnimationFrame(anchorFrame.current); };
  }, [measureBounds]);
  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.mensaje_id)), [pins]);
  const admin = group?.mi_rol === 'admin' || profile?.rol === 'admin' || profile?.rol === 'supervisor_instalacion';
  const textBlocked = Boolean(group?.solo_multimedia && !admin);
  const refresh = useCallback(async () => {
    const [latest, fixed] = await Promise.all([getGroupMessages(id, 100), getChatPins(id)]);
    if (activeRoom.current !== id) return;
    setMessages(latest.reverse()); setPins(fixed);
  }, [id]);

  useEffect(() => {
    activeRoom.current = id;
    let active = true;
    if (!id || !userId) { setLoading(false); return; }
    sendSequence.current++; sendLock.current = false; setSending(false);
    setLoading(true); setGroup(null); setMessages([]); setPins([]); setText(''); setReplyTo(null); setSelectedId(null); setTools(null); setNotice(''); setMediaPanelOpen(false); setMediaPanelReady(false);
    Promise.all([getChatGroupDetails(id, userId), refresh()]).then(([details]) => { if (active) setGroup(details); })
      .catch(() => { if (active) setNotice(errorCopy.current); }).finally(() => { if (active) setLoading(false); });
    const reload = () => { void refresh().catch(() => { if (active) setNotice(errorCopy.current); }); };
    const channel = supabase.channel(`chat_mobile_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `grupo_id=eq.${id}` }, reload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensajes' }, (payload) => {
        setReplyTo((prev) => prev?.id === payload.old.id ? null : prev);
        setSelectedId((prev) => prev === payload.old.id ? null : prev);
        setTools((prev) => prev?.kind === 'actions' && prev.message.id === payload.old.id ? null : prev);
        reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reacciones' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pins' }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_grupos', filter: `id=eq.${id}` }, (payload) => setGroup((prev) => prev ? { ...prev, ...payload.new } : null))
      .subscribe();
    return () => { active = false; activeRoom.current = ''; sendSequence.current++; void supabase.removeChannel(channel); };
  }, [id, userId, refresh]);

  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); if (focusTimer.current) clearTimeout(focusTimer.current); }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (id && userId) getChatGroupDetails(id, userId).then((details) => { if (active && details) setGroup(details); }).catch(() => { if (active) setNotice(errorCopy.current); });
    return () => { active = false; };
  }, [id, userId]));
  useFocusEffect(useCallback(() => {
    const back = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {
      if (mediaPanelOpen) { setMediaPanelOpen(false); return true; }
      if (selectedId) { setSelectedId(null); return true; }
      return false;
    }) : null;
    return () => { back?.remove(); };
  }, [selectedId, mediaPanelOpen]));

  const focusComposer = useCallback(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => inputRef.current?.focus(), 180);
  }, []);
  const reply = useCallback((message: ChatMessage) => {
    setReplyTo(message); setSelectedId(null); setTools(null); setMediaPanelOpen(false); focusComposer();
  }, [focusComposer]);
  const selectMessage = useCallback((message: ChatMessage, measure: (callback: (rect: ChatRect) => void) => void) => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    selectedIdRef.current = message.id; selectedMeasure.current = measure;
    setReactionAnchor(null); setSelectedId(message.id); setMediaPanelOpen(false); Keyboard.dismiss();
    measureSelection();
  }, [measureSelection]);
  const fail = useCallback(() => setNotice(c.failed), [c]);
  const reaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    setTools(null); setSelectedId(null); setNotice('');
    try { await toggleChatReaction(messageId, userId, emoji); await refresh(); } catch { setNotice(c.failed); }
  }, [userId, refresh, c]);
  const pin = useCallback(async (message: ChatMessage) => {
    setNotice('');
    try {
      if (pinnedIds.has(message.id)) await unpinChatMessage(message.id); else await pinChatMessage(message, userId);
      await refresh(); setSelectedId(null);
    } catch { setNotice(c.failed); }
  }, [pinnedIds, userId, refresh, c]);
  const copy = useCallback(async (message: ChatMessage) => {
    if (!message.contenido) return;
    try { const Clipboard = await import('expo-clipboard'); await Clipboard.setStringAsync(message.contenido); setNotice(c.copied); setSelectedId(null); } catch { setNotice(c.failed); }
  }, [c]);
  const remove = useCallback(async (message: ChatMessage) => {
    await deleteChatMessage(message.id);
    setMessages((prev) => prev.filter((item) => item.id !== message.id).map((item) => item.reply?.id === message.id ? { ...item, reply: null, reply_to_id: null } : item));
    setPins((prev) => prev.filter((item) => item.mensaje_id !== message.id));
    setReplyTo((prev) => prev?.id === message.id ? null : prev); setSelectedId(null);
    void refresh().catch(fail);
  }, [refresh, fail]);
  const jump = useCallback(async (messageId: string) => {
    try {
      let index = messages.findIndex((message) => message.id === messageId);
      if (index < 0) {
        const target = await getChatMessage(messageId);
        if (!target || target.grupo_id !== id) { setNotice(c.missing); return; }
        const merged = [...messages, target].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        index = merged.findIndex((message) => message.id === messageId); setMessages(merged);
      }
      setShowPins(false); setHighlighted(messageId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlighted(null), 1800);
      requestAnimationFrame(() => { void listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }).catch(fail); });
    } catch { setNotice(c.missing); }
  }, [messages, id, c, fail]);

  const send = useCallback(async (tipo: ChatMessageType, mediaUri?: string) => {
    if (!id || !userId || sendLock.current || (tipo === 'texto' && (!text.trim() || textBlocked))) return;
    sendLock.current = true; setSending(true); setNotice('');
    const operation = ++sendSequence.current;
    const content = tipo === 'texto' ? text.trim() : undefined;
    try {
      const sent = await sendChatMessage({ grupo_id: id, remitente_id: userId, tipo, contenido: content, mediaUri, reply_to_id: replyTo?.id });
      if (operation !== sendSequence.current || activeRoom.current !== id) return;
      // Render the sent message even if the realtime event arrives late or the refresh fails.
      const message = { ...sent, reply: replyTo, reacciones: [] };
      setMessages((prev) => prev.some((item) => item.id === sent.id) ? prev : [...prev, message]);
      if (tipo === 'texto') { setText(''); setSelection({ start: 0, end: 0 }); }
      setReplyTo(null); setSelectedId(null);
      requestAnimationFrame(() => { listRef.current?.scrollToEnd({ animated: true }); });
      void refresh().catch(fail);
    } catch { if (operation === sendSequence.current) setNotice(tipo === 'texto' ? c.sendFailed : c.failed); }
    finally { if (operation === sendSequence.current) { sendLock.current = false; setSending(false); } }
  }, [id, userId, text, textBlocked, replyTo, refresh, fail, c]);
  const capture = async () => { if (sending) return; try { const uri = await captureImageSafe({ quality: 0.8 }); if (uri) await send('imagen', uri); } catch { fail(); } };
  const gallery = async () => { if (sending) return; try { const uri = await pickImageSafe({ mediaTypes: 'all', quality: 0.85 }); if (uri) await send(/\.(mp4|mov)(?:\?|$)/i.test(uri) ? 'video' : 'imagen', uri); } catch { fail(); } };
  const chooseEmoji = (emoji: string) => {
    if (tools?.kind === 'actions') { void reaction(tools.message.id, emoji); return; }
    const next = insertEmoji(text, emoji, selection); setText(next.text); setSelection({ start: next.cursor, end: next.cursor });
  };
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => <ChatMessageBubble message={item} userId={userId} pinned={pinnedIds.has(item.id)} highlighted={highlighted === item.id} selected={selectedId === item.id}
    onActions={selectMessage} onReply={reply} onReaction={reaction} onImage={setFullImage} onJump={jump} onError={fail} />, [userId, pinnedIds, highlighted, selectedId, selectMessage, reply, reaction, jump, fail]);
  const selectedPin = pins.find((item) => item.mensaje_id === selected?.id);
  const canUnpinSelected = !selectedPin || selectedPin.pinned_by === userId || admin;
  const toolMessage = tools?.kind === 'actions' ? tools.message : null;
  const toolPin = pins.find((item) => item.mensaje_id === toolMessage?.id);

  return <View ref={rootRef} collapsable={false} onLayout={measureBounds} style={styles.container}>
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, styles.headerOverlay]} />
      {selected ? <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.cancel} onPress={() => setSelectedId(null)} style={styles.headerButton}><ArrowLeft size={22} color={P.white} /></Pressable>
        <Text style={styles.selectionCount}>1</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={c.reply} onPress={() => reply(selected)} style={styles.headerButton}><Reply size={23} color={P.white} /></Pressable>
        {canUnpinSelected ? <Pressable accessibilityRole="button" accessibilityLabel={selectedPin ? c.unpin : c.pin} onPress={() => void pin(selected)} style={styles.headerButton}>{selectedPin ? <PinOff size={21} color={P.white} /> : <Pin size={21} color={P.white} />}</Pressable> : null}
        {selected.contenido ? <Pressable accessibilityRole="button" accessibilityLabel={c.copy} onPress={() => void copy(selected)} style={styles.headerButton}><Copy size={20} color={P.white} /></Pressable> : null}
        {(selected.remitente_id === userId || admin) ? <Pressable accessibilityRole="button" accessibilityLabel={c.remove} onPress={() => setTools({ kind: 'actions', message: selected, initialPanel: 'delete' })} style={styles.headerButton}><Trash2 size={21} color={P.white} /></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={c.actions} onPress={() => setTools({ kind: 'actions', message: selected })} style={styles.headerButton}><MoreVertical size={22} color={P.white} /></Pressable>
      </View> : <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.back} onPress={() => router.back()} style={styles.headerButton}><ArrowLeft size={22} color={P.white} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={c.info} style={styles.groupInfo} onPress={() => router.push(`/chat/group-info/${id}` as any)}>
          {group?.foto_url ? <Image source={{ uri: group.foto_url }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{group?.nombre?.charAt(0).toUpperCase() || 'G'}</Text></View>}
          <View style={styles.groupTexts}><Text numberOfLines={1} style={styles.title}>{group?.nombre || c.loading}</Text><Text numberOfLines={1} style={styles.subtitle}>{group?.solo_multimedia ? c.restricted : `${group?.miembros_count || 1} ${c.members}`}</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={c.info} onPress={() => router.push(`/chat/group-info/${id}` as any)} style={styles.headerButton}><Info size={22} color={P.white} /></Pressable>
      </View>}
    </View>
    {pins.length ? <View style={styles.pinArea}><Pressable accessibilityRole="button" accessibilityLabel={c.pinned} accessibilityState={{ expanded: showPins }} onPress={() => setShowPins(!showPins)} style={styles.pinHeading}><Pin size={16} color={P.accent} /><Text style={styles.pinTitle}>{c.pinned} · {pins.length}</Text><Text numberOfLines={1} style={styles.pinSnippet}>{pins[0].message.contenido || c.photo}</Text><ChevronDown size={16} color={P.slate} /></Pressable>
      {showPins ? <View style={styles.pinList}><FlashList data={pins} keyExtractor={(item) => item.mensaje_id} renderItem={({ item }) => <View style={styles.pinRow}><Pressable accessibilityRole="button" accessibilityLabel={c.original} style={styles.pinMessage} onPress={() => void jump(item.mensaje_id)}><ReplyPreview message={item.message} userId={userId} /></Pressable>{(admin || item.pinned_by === userId) ? <Pressable accessibilityRole="button" accessibilityLabel={c.unpin} style={styles.iconButton} onPress={() => void pin(item.message)}><PinOff size={18} color={P.slate} /></Pressable> : null}</View>} /></View> : null}
    </View> : null}
    {notice ? <View accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeText}>{notice}</Text><Pressable accessibilityLabel={c.close} onPress={() => setNotice('')} style={styles.iconButton}><X size={16} color={P.slate} /></Pressable></View> : null}
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View ref={feedRef} collapsable={false} style={styles.flex} onLayout={measureBounds}>
      {loading ? <View style={styles.center}><ActivityIndicator color={P.accent} /><Text style={styles.empty}>{c.loading}</Text></View> : !group ? <View style={styles.center}><Text style={styles.empty}>{c.unavailable}</Text><Pressable onPress={() => { setLoading(true); Promise.all([getChatGroupDetails(id, userId), refresh()]).then(([details]) => setGroup(details)).catch(fail).finally(() => setLoading(false)); }} style={styles.retry}><Text style={styles.pinTitle}>{c.retry}</Text></Pressable></View> : <FlashList ref={listRef} data={messages} renderItem={renderMessage} keyExtractor={messageKey} getItemType={messageType} extraData={feedExtra} onScroll={measureSelection} scrollEventThrottle={16}
        maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.feed} ListEmptyComponent={<Text style={styles.empty}>{c.emptyChat}</Text>} />}
      </View>
      {replyTo ? <View style={styles.replyComposer}><View style={styles.flex}><ReplyPreview message={replyTo} userId={userId} /></View><Pressable accessibilityRole="button" accessibilityLabel={c.cancelReply} style={styles.iconButton} onPress={() => setReplyTo(null)}><X size={20} color={P.slate} /></Pressable></View> : null}
      {textBlocked ? <Text style={styles.restricted}>{c.restricted}</Text> : null}
      {group ? <View style={[styles.inputArea, { paddingBottom: mediaPanelOpen ? 8 : Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={mediaPanelOpen ? c.keyboard : c.mediaPicker} disabled={sending} style={styles.iconButton} onPress={() => { if (mediaPanelOpen) { setMediaPanelOpen(false); focusComposer(); } else { Keyboard.dismiss(); setSelectedId(null); setMediaPanelOpen(true); } }}>{mediaPanelOpen ? <KeyboardIcon size={23} color={P.slate} /> : <Smile size={23} color={P.slate} />}</Pressable>
          <TextInput ref={inputRef} accessibilityLabel={c.message} style={styles.input} placeholder={textBlocked ? c.restricted : c.placeholder} placeholderTextColor={P.muted} multiline editable={!textBlocked && !sending} value={text} onChangeText={setText} onFocus={() => setMediaPanelOpen(false)} selection={selection} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} />
          <Pressable accessibilityRole="button" accessibilityLabel={c.gallery} disabled={sending} style={styles.attachmentIcon} onPress={() => void gallery()}><Paperclip size={20} color={P.slate} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={c.camera} disabled={sending} style={styles.iconButton} onPress={() => void capture()}><Camera size={22} color={P.slate} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={c.send} disabled={textBlocked || sending || !text.trim()} onPress={() => void send('texto')} style={[styles.send, (textBlocked || sending || !text.trim()) && styles.disabled]}>{sending ? <ActivityIndicator size="small" color={P.white} /> : <Send size={19} color={P.white} />}</Pressable>
        </View>
      </View> : null}
      {(mediaPanelReady || mediaPanelOpen) && group ? <View style={!mediaPanelOpen ? styles.closedMediaPanel : undefined} pointerEvents={mediaPanelOpen ? 'auto' : 'none'} accessibilityElementsHidden={!mediaPanelOpen} importantForAccessibility={mediaPanelOpen ? 'auto' : 'no-hide-descendants'}>
        <ComposerMediaPanel key={`${id}:${userId}`} userId={userId} textBlocked={textBlocked} sending={sending} onEmoji={chooseEmoji} onSticker={(url) => { void send('sticker', url); }} onClose={() => { Keyboard.dismiss(); setMediaPanelOpen(false); }} />
      </View> : null}
    </KeyboardAvoidingView>
    {selected && reactionAnchor?.id === selected.id && rootBounds && feedBounds && !tools ? <MessageReactions anchor={reactionAnchor} viewport={feedBounds} root={rootBounds} outgoing={selected.remitente_id === userId} onReact={(emoji) => { void reaction(selected.id, emoji); }} onMore={() => setTools({ kind: 'actions', message: selected, initialPanel: 'emoji' })} /> : null}
    {tools ? <ChatToolsModal key={tools.kind === 'actions' ? tools.message.id : 'composer'} target={tools} userId={userId} canDelete={Boolean(toolMessage && (toolMessage.remitente_id === userId || admin))} pinned={Boolean(toolPin)} canUnpin={!toolPin || toolPin.pinned_by === userId || admin}
      onClose={() => setTools(null)} onReply={() => { if (toolMessage) reply(toolMessage); }} onCopy={() => { if (toolMessage) void copy(toolMessage); }} onPin={() => { if (toolMessage) void pin(toolMessage); }} onDelete={() => toolMessage ? remove(toolMessage) : Promise.resolve()} onEmoji={chooseEmoji} /> : null}
    <Modal visible={Boolean(fullImage)} transparent animationType="fade" onRequestClose={() => setFullImage(null)}><View style={[styles.lightbox, { paddingTop: insets.top }]}><Pressable accessibilityRole="button" accessibilityLabel={c.closeImage} onPress={() => setFullImage(null)} style={styles.lightboxClose}><X size={24} color={P.white} /></Pressable>{fullImage ? <Image source={{ uri: fullImage }} style={styles.lightboxImage} contentFit="contain" /> : null}</View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  closedMediaPanel: { height: 0, opacity: 0, overflow: 'hidden' },
  attachmentIcon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: P.white }, flex: { flex: 1 }, header: { overflow: 'hidden' }, headerOverlay: { backgroundColor: P.header }, headerRow: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2 }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, groupInfo: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 10, alignItems: 'center' }, groupTexts: { flex: 1 }, avatar: { width: 38, height: 38, borderRadius: 19 }, avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: P.accent, alignItems: 'center', justifyContent: 'center' }, avatarLetter: { fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 16 }, title: { fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 15 }, subtitle: { fontFamily: 'Outfit_400Regular', color: P.white, opacity: 0.75, fontSize: 11, marginTop: 3 }, selectionCount: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 20 },
  quickBar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 4, borderBottomWidth: 1, borderColor: P.line }, quickButton: { minWidth: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, feed: { paddingHorizontal: 12, paddingVertical: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, empty: { textAlign: 'center', color: P.muted, fontFamily: 'Outfit_400Regular', padding: 24, lineHeight: 22 }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: P.line, borderRadius: 8 },
  pinArea: { borderBottomWidth: 1, borderColor: P.line, paddingHorizontal: 12 }, pinHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, pinTitle: { fontFamily: 'Outfit_600SemiBold', color: P.slate, fontSize: 12 }, pinSnippet: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, color: P.muted }, pinList: { height: 160, marginBottom: 8 }, pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, pinMessage: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: P.line, paddingLeft: 16 }, noticeText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, color: P.slate, lineHeight: 18 }, replyComposer: { borderTopWidth: 1, borderColor: P.line, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, restricted: { fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  inputArea: { paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, borderColor: P.line }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 }, iconButton: { width: 42, height: 44, justifyContent: 'center', alignItems: 'center' }, input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21, color: P.ink, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, borderRadius: 8, backgroundColor: P.wash }, send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: P.accent, marginLeft: 4 }, disabled: { opacity: 0.4 }, attachments: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 12, paddingTop: 2 }, attachment: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 }, attachmentLabel: { fontFamily: 'Outfit_400Regular', color: P.muted, fontSize: 11 },
  lightbox: { flex: 1, backgroundColor: P.ink }, lightboxClose: { alignSelf: 'flex-end', padding: 16 }, lightboxImage: { flex: 1, width: '100%' },
});
