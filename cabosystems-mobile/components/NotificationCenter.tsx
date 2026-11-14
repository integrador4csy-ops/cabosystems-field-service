import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, Check, CheckCheck, ClipboardCheck, ListChecks, MessageCircle, ShieldCheck, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { BorderRadius, Colors, Shadow, Spacing } from '@/constants/Theme';

type AppNotification = {
  id: string;
  kind: 'task_assigned' | 'field_check' | 'chat_message' | 'warranty_update' | 'system';
  title: string;
  body: string;
  target: string | null;
  target_id: string | null;
  read_at: string | null;
  created_at: string;
};

let notificationChannelSequence = 0;

function relativeTime(value: string, english: boolean) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return english ? 'Now' : 'Ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return english ? `${minutes}m ago` : `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return english ? `${hours}h ago` : `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return english ? `${days}d ago` : `Hace ${days} d`;
}

let cachedNotificationItems: AppNotification[] = [];

export function NotificationCenter() {
  const { profile } = useAuth();
  const { t, language } = useTranslation();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(() => cachedNotificationItems);
  const client = supabase as any;

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await client.from('app_notifications').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    if (!error && data) {
      cachedNotificationItems = data;
      setItems(data);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    void load();
    const channel = client.channel(`mobile-notifications-${profile.id}-${++notificationChannelSequence}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [profile?.id, load]);

  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const markAllRead = useCallback(async () => {
    if (!profile?.id || unread === 0) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    await client.from('app_notifications').update({ read_at: readAt }).eq('user_id', profile.id).is('read_at', null);
  }, [profile?.id, unread]);

  const openItem = useCallback(async (item: AppNotification) => {
    setVisible(false);
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
      void client.from('app_notifications').update({ read_at: readAt }).eq('id', item.id);
    }
    if (item.target === 'checks') router.push('/(tabs)/checks' as any);
    else if (item.target === 'chat') router.push('/(tabs)/chat' as any);
    else router.push('/(tabs)' as any);
  }, [router]);

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Notificaciones')} accessibilityState={{ expanded: visible }}
      onPress={() => setVisible(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <Bell size={21} color={Colors.brandSlate} strokeWidth={2.2} />
      {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View><Text style={styles.title}>{t('Notificaciones')}</Text><Text style={styles.subtitle}>{language === 'en' ? 'Latest activity' : 'Actividad reciente'}</Text></View>
            <View style={styles.headerActions}>
              {unread > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={language === 'en' ? 'Mark all as read' : 'Marcar todas como leídas'} onPress={markAllRead} style={styles.iconButton}><CheckCheck size={19} color={Colors.primary} /></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('Cerrar')} onPress={() => setVisible(false)} style={styles.iconButton}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> : null}
            {!loading && items.length === 0 ? <View style={styles.empty}><Bell size={28} color={Colors.textSecondary} /><Text style={styles.emptyTitle}>{language === 'en' ? 'You are up to date' : 'Estás al día'}</Text><Text style={styles.emptyText}>{language === 'en' ? 'New assignments, checks and messages will appear here.' : 'Aquí aparecerán nuevas asignaciones, checks y mensajes.'}</Text></View> : null}
            {items.map((item) => {
              const Icon = item.kind === 'chat_message' ? MessageCircle : item.kind === 'field_check' ? ClipboardCheck : item.kind === 'warranty_update' ? ShieldCheck : ListChecks;
              return <Pressable key={item.id} onPress={() => openItem(item)} style={({ pressed }) => [styles.item, !item.read_at && styles.itemUnread, pressed && styles.pressed]}>
                <View style={styles.itemIcon}><Icon size={19} color={Colors.primary} /></View>
                <View style={styles.itemBody}><View style={styles.itemTitleRow}><Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>{!item.read_at ? <View style={styles.unreadDot} /> : <Check size={14} color={Colors.textSecondary} />}</View><Text numberOfLines={2} style={styles.itemText}>{item.body}</Text><Text style={styles.time}>{relativeTime(item.created_at, language === 'en')}</Text></View>
              </Pressable>;
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F7F8', position: 'relative' },
  pressed: { opacity: 0.68 },
  badge: { position: 'absolute', top: 3, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 9 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.42)' },
  sheet: { maxHeight: '78%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', ...Shadow.lg },
  sheetHeader: { minHeight: 72, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: Colors.text },
  subtitle: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 12, color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  listContent: { padding: Spacing.md, paddingBottom: 34 },
  loader: { marginVertical: 44 },
  item: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: BorderRadius.lg, marginBottom: 7, backgroundColor: '#FFFFFF' },
  itemUnread: { backgroundColor: '#FFF7EE' },
  itemIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF0E0', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: Colors.text },
  itemText: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  time: { marginTop: 5, fontFamily: 'Outfit_500Medium', fontSize: 11, color: Colors.textSecondary },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 48 },
  emptyTitle: { marginTop: 12, fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: Colors.text },
  emptyText: { marginTop: 5, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', color: Colors.textSecondary },
});
