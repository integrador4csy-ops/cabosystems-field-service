import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reply, Copy, Smile, Pin, PinOff, Trash2, Plus, X } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/types/database';
import { FluentEmoji } from './FluentEmoji';
import { ReplyPreview } from './ReplyPreview';
import EmojiPicker from './EmojiPicker';
const quick = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
export type ChatToolTarget = { kind: 'actions'; message: ChatMessage; initialPanel?: 'delete' | 'emoji' } | { kind: 'emoji' };

export function ChatToolsModal({ target, userId, canDelete, pinned, canUnpin, onClose, onReply, onCopy, onPin, onDelete, onEmoji }: {
  target: ChatToolTarget; userId: string; canDelete: boolean; pinned: boolean; canUnpin: boolean;
  onClose: () => void; onReply: () => void; onCopy: () => void; onPin: () => void;
  onDelete: () => Promise<void>; onEmoji: (emoji: string) => void;
}) {
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const insets = useSafeAreaInsets(); const { height } = useWindowDimensions();
  const [panel, setPanel] = useState<'actions' | 'emoji' | 'delete'>(target.kind === 'emoji' ? 'emoji' : target.initialPanel || 'actions');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const close = () => { if (!busy) onClose(); };
  const action = (callback: () => void) => { onClose(); callback(); };
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={close}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={c.close} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: height - insets.top - 20 }]}>
        <View style={styles.heading}><Text style={styles.title}>{panel === 'emoji' ? c.picker : panel === 'delete' ? c.remove : c.actions}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} disabled={busy} onPress={close} style={styles.close}><X size={20} color={P.slate} /></Pressable></View>
        {panel === 'emoji' ? <EmojiPicker onSelect={onEmoji} /> : panel === 'delete' ? <View>
          <Text style={styles.notice}>{c.deleteNotice}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.notice}>{c.failed}</Text> : null}
          <View style={styles.confirmRow}><Pressable disabled={busy} onPress={() => setPanel('actions')} style={styles.cancel}><Text style={styles.label}>{c.cancel}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.confirm} onPress={async () => { setBusy(true); setError(false); try { await onDelete(); onClose(); } catch { setError(true); } finally { setBusy(false); } }}>
              {busy ? <ActivityIndicator size="small" color={P.white} /> : null}<Text style={styles.confirmText}>{busy ? c.deleting : c.remove}</Text>
            </Pressable></View>
        </View> : <>
          <View style={styles.quick} accessibilityLabel={c.quick}>{quick.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`${c.react} ${emoji}`} onPress={() => onEmoji(emoji)} style={styles.quickButton}><FluentEmoji emoji={emoji} size={30} /></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={c.more} onPress={() => setPanel('emoji')} style={styles.quickButton}><Plus size={23} color={P.slate} /></Pressable></View>
          {target.kind === 'actions' ? <View style={styles.quote}><ReplyPreview message={target.message} userId={userId} /></View> : null}
          <Pressable accessibilityRole="button" onPress={() => action(onReply)} style={styles.option}><Reply size={20} color={P.slate} /><Text style={styles.label}>{c.reply}</Text></Pressable>
          {target.kind === 'actions' && target.message.contenido ? <Pressable accessibilityRole="button" onPress={() => action(onCopy)} style={styles.option}><Copy size={20} color={P.slate} /><Text style={styles.label}>{c.copy}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => setPanel('emoji')} style={styles.option}><Smile size={20} color={P.slate} /><Text style={styles.label}>{c.react}</Text></Pressable>
          {(!pinned || canUnpin) ? <Pressable accessibilityRole="button" onPress={() => action(onPin)} style={styles.option}>{pinned ? <PinOff size={20} color={P.slate} /> : <Pin size={20} color={P.slate} />}<Text style={styles.label}>{pinned ? c.unpin : c.pin}</Text></Pressable> : null}
          {canDelete ? <Pressable accessibilityRole="button" onPress={() => setPanel('delete')} style={[styles.option, styles.deleteOption]}><Trash2 size={20} color={P.slate} /><Text style={styles.label}>{c.remove}</Text></Pressable> : null}
        </>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: P.overlay }, sheet: { width: '100%', maxWidth: 540, alignSelf: 'center', backgroundColor: P.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, flexShrink: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, title: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: P.slate }, close: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: P.line, paddingBottom: 10, marginBottom: 10 }, quickButton: { flex: 1, maxWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' }, quote: { marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 14, paddingHorizontal: 8 }, label: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: P.slate }, deleteOption: { borderTopWidth: 1, borderTopColor: P.line, marginTop: 4 }, notice: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 21, color: P.muted, marginVertical: 14 },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginVertical: 10 }, cancel: { borderWidth: 1, borderColor: P.line, paddingHorizontal: 16, minHeight: 44, borderRadius: 8, justifyContent: 'center' }, confirm: { backgroundColor: P.slate, minHeight: 44, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, confirmText: { fontFamily: 'Outfit_500Medium', color: P.white, fontSize: 14 }, loader: { height: 260 },
});
