import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { captureImageSafe, pickImageSafe } from '@/lib/mediaPicker';
import {
  ArrowLeft,
  Info,
  Send,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Play,
  Check,
  Video,
  Smile,
  X,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  getChatGroupDetails,
  getGroupMessages,
  sendChatMessage,
  toggleChatReaction,
} from '@/lib/chatApi';
import type { ChatGroup, ChatMessage, ChatMessageType } from '@/types/database';
import StickerPickerModal from '@/components/chat/StickerPickerModal';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🛠️', '✅', '😂'];

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');

  // Modales
  const [showStickers, setShowStickers] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id && profile?.id) {
      loadGroupAndMessages();
      const unsubscribe = setupRealtimeSubscription();
      return () => {
        unsubscribe?.();
      };
    }
  }, [id, profile?.id]);

  // Actualizar configuración del grupo al volver de la pantalla de info
  useFocusEffect(
    useCallback(() => {
      if (id && profile?.id) {
        getChatGroupDetails(id, profile.id).then((grp) => {
          if (grp) setGroup(grp);
        });
      }
    }, [id, profile?.id])
  );

  const loadGroupAndMessages = async () => {
    if (!id || !profile?.id) return;
    try {
      setLoading(true);
      const [grp, msgs] = await Promise.all([
        getChatGroupDetails(id, profile.id),
        getGroupMessages(id, 60),
      ]);
      setGroup(grp);
      setMessages(msgs);
    } catch (err) {
      console.error('Error loading chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!id) return;

    const channel = supabase
      .channel(`chat_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `grupo_id=eq.${id}`,
        },
        async (payload) => {
          // Obtener perfil del remitente
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.remitente_id)
            .single();

          const newMsg: ChatMessage = {
            ...(payload.new as ChatMessage),
            profiles: senderProfile,
            reacciones: [],
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reacciones',
        },
        () => {
          // Recargar mensajes para refrescar reacciones en vivo
          if (id) {
            getGroupMessages(id, 60).then((msgs) => setMessages(msgs));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_grupos',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          // Actualización instantánea en vivo cuando el admin activa/desactiva Solo Multimedia
          setGroup((prev) =>
            prev ? { ...prev, ...(payload.new as ChatGroup) } : (payload.new as ChatGroup)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const isUserAdmin =
    group?.mi_rol === 'admin' ||
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion';

  // Si el grupo está en 'solo_multimedia', se bloquea el cuadro de texto para modo solo imágenes/videos
  const isTextBlocked = !!group?.solo_multimedia;

  // Enviar mensaje de texto
  const handleSendText = async () => {
    if (isTextBlocked) {
      Alert.alert(
        'Modo Solo Imágenes',
        'Este grupo está configurado en modo multimedia. Solo se permite el envío de fotos y videos de evidencia.'
      );
      return;
    }
    if (!text.trim() || !id || !profile?.id || sending) return;

    const content = text.trim();
    setText('');
    setSending(true);

    try {
      await sendChatMessage({
        grupo_id: id,
        remitente_id: profile.id,
        tipo: 'texto',
        contenido: content,
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      Alert.alert('Error', err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  // Enviar foto instantánea desde la cámara
  const handleCaptureCamera = async () => {
    if (!id || !profile?.id || sending) return;
    const uri = await captureImageSafe({ quality: 0.8 });
    if (uri) {
      await sendMediaMessage(uri, 'imagen');
    }
  };

  // Enviar foto o video desde la galería
  const handlePickGallery = async () => {
    if (!id || !profile?.id || sending) return;
    const uri = await pickImageSafe({ mediaTypes: 'all', quality: 0.85 });
    if (uri) {
      const isVideo = uri.toLowerCase().includes('.mp4') || uri.toLowerCase().includes('.mov');
      await sendMediaMessage(uri, isVideo ? 'video' : 'imagen');
    }
  };

  // Enviar Sticker de WhatsApp
  const handleSelectSticker = async (stickerUrl: string) => {
    if (!id || !profile?.id) return;
    await sendMediaMessage(stickerUrl, 'sticker');
  };

  const sendMediaMessage = async (uri: string, tipo: ChatMessageType) => {
    if (!id || !profile?.id) return;
    setSending(true);
    try {
      await sendChatMessage({
        grupo_id: id,
        remitente_id: profile.id,
        tipo,
        mediaUri: uri,
      });
    } catch (err: any) {
      console.error('Error sending media:', err);
      Alert.alert('Error', 'No se pudo enviar el archivo multimedia.');
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!profile?.id) return;
    setActiveReactionMsgId(null);
    try {
      await toggleChatReaction(messageId, profile.id, emoji);
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  const renderMessageItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.remitente_id === profile?.id;
      const senderName = item.profiles?.nombre || 'Técnico';
      const senderRole = item.profiles?.rol
        ? item.profiles.rol.toUpperCase().replace(/_/g, ' ')
        : 'TÉCNICO';

      // Agrupar reacciones
      const reactionCounts = (item.reacciones || []).reduce<Record<string, number>>(
        (acc, curr) => {
          acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
          return acc;
        },
        {}
      );

      const hasReactions = Object.keys(reactionCounts).length > 0;
      const timeStr = new Date(item.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Render específico para stickers
      if (item.tipo === 'sticker' && item.media_url) {
        return (
          <Pressable
            onLongPress={() => setActiveReactionMsgId(item.id)}
            style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}
          >
            <View style={styles.stickerContainer}>
              {!isMe && <Text style={styles.senderLabel}>{senderName}</Text>}
              <Image source={{ uri: item.media_url }} style={styles.stickerImage} contentFit="contain" />
              <Text style={styles.stickerTime}>{timeStr}</Text>

              {hasReactions && (
                <View style={styles.reactionsPill}>
                  {Object.entries(reactionCounts).map(([emoji, count]) => (
                    <Pressable
                      key={emoji}
                      onPress={() => handleToggleReaction(item.id, emoji)}
                      style={styles.reactionItem}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        );
      }

      return (
        <Pressable
          onLongPress={() => setActiveReactionMsgId(item.id)}
          style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}
        >
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {!isMe && (
              <View style={styles.senderHeader}>
                <Text style={styles.senderName}>{senderName}</Text>
                <Text style={styles.senderRoleTag}>{senderRole}</Text>
              </View>
            )}

            {/* Imagen */}
            {item.tipo === 'imagen' && item.media_url && (
              <Pressable
                onPress={() => setFullScreenImageUri(item.media_url)}
                style={styles.mediaPressable}
              >
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.mediaImage}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            )}

            {/* Video */}
            {item.tipo === 'video' && item.media_url && (
              <View style={styles.videoBox}>
                <View style={styles.videoPlaceholder}>
                  <View style={styles.videoPlayBtn}>
                    <Play size={24} color="#ffffff" fill="#ffffff" />
                  </View>
                  <View style={styles.videoBadge}>
                    <Video size={12} color="#ffffff" />
                    <Text style={styles.videoBadgeText}>VIDEO TÉCNICO</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Texto */}
            {!!item.contenido && (
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                {item.contenido}
              </Text>
            )}

            <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
              {timeStr}
            </Text>

            {/* Reacciones */}
            {hasReactions && (
              <View style={styles.reactionsPill}>
                {Object.entries(reactionCounts).map(([emoji, count]) => (
                  <Pressable
                    key={emoji}
                    onPress={() => handleToggleReaction(item.id, emoji)}
                    style={[styles.reactionItem, isMe && styles.reactionItemMe]}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {count > 1 && (
                      <Text style={[styles.reactionCount, isMe && styles.reactionCountMe]}>
                        {count}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [profile?.id]
  );

  return (
    <View style={styles.container}>
      {/* Header Minimalista en Modo Claro */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <ArrowLeft size={20} color={Colors.text} />
          </Pressable>

          <Pressable
            style={styles.headerInfo}
            onPress={() => router.push(`/chat/group-info/${id}` as any)}
          >
            {group?.foto_url ? (
              <Image source={{ uri: group.foto_url }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarLetter}>
                  {group?.nombre ? group.nombre.charAt(0).toUpperCase() : 'G'}
                </Text>
              </View>
            )}

            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {group?.nombre || 'Cargando...'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {group?.solo_multimedia
                  ? '🔒 Solo fotos y videos'
                  : `${group?.miembros_count || 1} integrantes`}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/chat/group-info/${id}` as any)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <Info size={22} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Lista de Mensajes */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Cargando mensajes del equipo...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Banner de Modo Solo Imágenes */}
        {isTextBlocked && (
          <View style={styles.restrictedBanner}>
            <Video size={14} color={Colors.primary} />
            <Text style={styles.restrictedText}>
              Modo Solo Imágenes activo: Solo fotos y videos permitidos.
            </Text>
          </View>
        )}

        {/* Barra de Entrada / Adjuntos */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={styles.iconBtn} onPress={handleCaptureCamera} disabled={sending}>
            <Camera size={20} color={Colors.primary} />
          </Pressable>

          <Pressable style={styles.iconBtn} onPress={handlePickGallery} disabled={sending}>
            <ImageIcon size={20} color={Colors.textSecondary} />
          </Pressable>

          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowStickers(true)}
            disabled={sending}
          >
            <Sparkles size={20} color={Colors.primary} />
          </Pressable>

          {!isTextBlocked ? (
            <TextInput
              style={styles.textInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
          ) : (
            <View style={styles.textInputDisabled}>
              <Text style={styles.textInputDisabledLabel}>
                📷 Solo fotos y videos permitidos
              </Text>
            </View>
          )}

          {!isTextBlocked && (
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                (!text.trim() || sending) && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleSendText}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={18} color="#ffffff" />
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Popover de Reacciones Rápidas */}
      <Modal
        visible={!!activeReactionMsgId}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveReactionMsgId(null)}
      >
        <Pressable style={styles.reactionBackdrop} onPress={() => setActiveReactionMsgId(null)}>
          <View style={styles.reactionBar}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={({ pressed }) => [
                  styles.reactionChoice,
                  pressed && { transform: [{ scale: 1.25 }] },
                ]}
                onPress={() => activeReactionMsgId && handleToggleReaction(activeReactionMsgId, emoji)}
              >
                <Text style={styles.reactionChoiceEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Imagen a Pantalla Completa */}
      <Modal
        visible={!!fullScreenImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImageUri(null)}
      >
        <View style={styles.fullScreenBackdrop}>
          <Pressable
            style={[styles.fullScreenClose, { top: insets.top + 10 }]}
            onPress={() => setFullScreenImageUri(null)}
            hitSlop={12}
          >
            <X size={24} color="#ffffff" />
          </Pressable>
          {fullScreenImageUri && (
            <Image
              source={{ uri: fullScreenImageUri }}
              style={styles.fullScreenImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>

      {/* Selector de Stickers de WhatsApp */}
      {profile?.id && (
        <StickerPickerModal
          visible={showStickers}
          onClose={() => setShowStickers(false)}
          onSelectSticker={handleSelectSticker}
          userId={profile.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
    ...Shadow.xs,
  },
  headerContent: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarLetter: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.primary,
  },
  headerTexts: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  msgRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    position: 'relative',
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  senderName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  senderRoleTag: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
  },
  msgText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextMe: {
    color: '#ffffff',
  },
  msgTextOther: {
    color: Colors.text,
  },
  msgTime: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 9.5,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  msgTimeMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  msgTimeOther: {
    color: Colors.textMuted,
  },
  mediaPressable: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  mediaImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
  },
  videoBox: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  videoPlaceholder: {
    width: 220,
    height: 140,
    backgroundColor: '#F2F4F7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  videoPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9,
    color: '#ffffff',
  },
  stickerContainer: {
    position: 'relative',
    padding: 4,
  },
  senderLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    marginBottom: 2,
  },
  stickerImage: {
    width: 120,
    height: 120,
  },
  stickerTime: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  reactionsPill: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  reactionItemMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: Colors.text,
    marginLeft: 3,
  },
  reactionCountMe: {
    color: '#ffffff',
  },
  restrictedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: '#FED7AA',
  },
  restrictedText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 90,
    color: Colors.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  textInputDisabled: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    justifyContent: 'center',
  },
  textInputDisabledLabel: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reactionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  reactionChoice: {
    padding: 2,
  },
  reactionChoiceEmoji: {
    fontSize: 26,
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenClose: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.full,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
