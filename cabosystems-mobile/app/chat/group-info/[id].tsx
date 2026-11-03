import { getRoleLabel } from '@/lib/localization';
import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { pickImageSafe } from '@/lib/mediaPicker';
import {
  ArrowLeft,
  Camera,
  Users,
  UserPlus,
  Trash2,
  LogOut,
  Video,
  Shield,
  Search,
  Check,
  Edit2,
  X,
  Paperclip,
  Play,
  FileText,
  Mic,
  Download,
  Home,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { TaskFilterSelect } from '@/components/TaskFilterSelect';
import {
  getChatGroupDetails,
  getGroupMembers,
  getGroupAttachments,
  updateChatGroup,
  addChatGroupMembers,
  removeChatGroupMember,
  deleteChatGroup,
  getAllProfilesForInvite,
} from '@/lib/chatApi';
import type { ChatGroup, ChatMember, ChatMessage, Profile, Project } from '@/types/database';
import { getMyProjects } from '@/lib/api';
import { getDocumentInfo } from '@/lib/chatDocumentTypes';
import { ChatDocumentBadge } from '@/components/chat/ChatDocumentBadge';
import { ChatDocumentPreviewModal } from '@/components/chat/ChatDocumentPreviewModal';
import { ChatVideoPlayerModal } from '@/components/chat/ChatVideoPlayerModal';
import { GroupTaskActivitySection } from '@/components/chat/GroupTaskActivitySection';
import { useTranslation } from '@/lib/i18n';
import { CHAT_COPY } from '@/lib/chatCopy';

export default function GroupInfoScreen() {
  const { t: tr } = useInterfaceTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { language } = useTranslation();
  const c = CHAT_COPY[language];

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [attachments, setAttachments] = useState<ChatMessage[]>([]);
  const [mediaTab, setMediaTab] = useState<'all' | 'media' | 'docs' | 'audio'>('all');
  const [activeDoc, setActiveDoc] = useState<{ url: string; fileName?: string; fileSize?: number; mimeType?: string } | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Edición rápida de Admin
  const [editingInfo, setEditingInfo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  // Modal para agregar miembros
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [addingMembers, setAddingMembers] = useState(false);

  useEffect(() => {
    if (id && profile?.id) {
      loadData();
    }
  }, [id, profile?.id]);

  const loadData = async () => {
    if (!id || !profile?.id) return;
    try {
      setLoading(true);
      const [grp, mems, atts, projs] = await Promise.all([
        getChatGroupDetails(id, profile.id),
        getGroupMembers(id),
        getGroupAttachments(id),
        getMyProjects().catch(() => []),
      ]);
      setGroup(grp);
      setMembers(mems);
      setAttachments(atts);
      setAvailableProjects(projs);
      if (grp) {
        setNombre(grp.nombre);
        setDescripcion(grp.descripcion || '');
        setEditProjectId(grp.proyecto_id || null);
      }
    } catch (err) {
      console.error('Error loading group info:', err);
    } finally {
      setLoading(false);
    }
  };

  const isUserAdmin =
    group?.mi_rol === 'admin' ||
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion';

  // Cambiar foto del grupo
  const handleChangePhoto = async () => {
    if (!isUserAdmin || !id) return;

    const uri = await pickImageSafe({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (uri) {
      try {
        setLoading(true);
        await updateChatGroup(id, { fotoUri: uri });
        await loadData();
        Alert.alert(tr("Éxito"), tr("Foto del grupo actualizada."));
      } catch (err) {
        console.error('Error updating group photo:', err);
        Alert.alert(tr("Error"), tr("No se pudo actualizar la foto."));
      } finally {
        setLoading(false);
      }
    }
  };

  // Toggle Solo Multimedia
  const handleToggleSoloMultimedia = async (newValue: boolean) => {
    if (!isUserAdmin || !id) return;
    try {
      setGroup((prev) => (prev ? { ...prev, solo_multimedia: newValue } : null));
      await updateChatGroup(id, { solo_multimedia: newValue });
    } catch (err) {
      console.error('Error toggling solo multimedia:', err);
      Alert.alert(tr("Error"), tr("No se pudo cambiar la configuración multimedia."));
      loadData();
    }
  };

  // Guardar nombre y descripción
  const handleSaveInfo = async () => {
    if (!isUserAdmin || !id || !nombre.trim()) return;
    try {
      setSavingInfo(true);
      await updateChatGroup(id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        proyecto_id: editProjectId || null,
      });
      setEditingInfo(false);
      await loadData();
      Alert.alert(tr("Éxito"), tr("Información del grupo actualizada."));
    } catch (err) {
      console.error('Error updating group info:', err);
      Alert.alert(tr("Error"), tr("No se pudo guardar la información."));
    } finally {
      setSavingInfo(false);
    }
  };

  // Abrir modal de invitar
  const handleOpenAddModal = async () => {
    try {
      const all = await getAllProfilesForInvite();
      const currentMemberIds = new Set(members.map((m) => m.profile_id));
      setAvailableProfiles(all.filter((p) => !currentMemberIds.has(p.id)));
      setSelectedToAdd([]);
      setShowAddMembers(true);
    } catch (err) {
      console.error('Error loading profiles to add:', err);
    }
  };

  // Confirmar agregar miembros
  const handleConfirmAddMembers = async () => {
    if (!id || selectedToAdd.length === 0) return;
    try {
      setAddingMembers(true);
      await addChatGroupMembers(id, selectedToAdd);
      setShowAddMembers(false);
      await loadData();
      Alert.alert(tr("Éxito"), tr("Nuevos miembros agregados al grupo."));
    } catch (err) {
      console.error('Error adding members:', err);
      Alert.alert(tr("Error"), tr("No se pudieron agregar los miembros."));
    } finally {
      setAddingMembers(false);
    }
  };

  // Expulsar miembro
  const handleRemoveMember = (member: ChatMember) => {
    if (!isUserAdmin || !id) return;
    if (member.profile_id === profile?.id) {
      Alert.alert(tr("Acción no permitida"), tr("No puedes expulsarte a ti mismo del grupo."));
      return;
    }

    Alert.alert(
      tr('Expulsar Integrante'),
      tr("¿Deseas remover a \"{value0}\" del grupo?", { value0: member.profiles?.nombre || tr('este usuario') }),
      [
        { text: tr("Cancelar"), style: 'cancel' },
        {
          text: tr("Expulsar"),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeChatGroupMember(id, member.profile_id);
              await loadData();
            } catch (err) {
              console.error('Error removing member:', err);
              Alert.alert(tr("Error"), tr("No se pudo remover al miembro."));
            }
          },
        },
      ]
    );
  };

  // Eliminar grupo
  const handleDeleteGroup = () => {
    if (!isUserAdmin || !id) return;

    Alert.alert(
      tr("Eliminar Grupo"),
      tr("¿Estás seguro de que deseas eliminar definitivamente el grupo \"{value0}\"? Esta acción borrará todos los mensajes y no se puede deshacer.", { value0: group?.nombre }),
      [
        { text: tr("Cancelar"), style: 'cancel' },
        {
          text: tr("Eliminar Definitivamente"),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteChatGroup(id);
              Alert.alert('Grupo Eliminado', tr("El grupo fue eliminado con éxito."));
              router.replace('/(tabs)/chat');
            } catch (err) {
              console.error('Error deleting group:', err);
              Alert.alert(tr("Error"), tr("No se pudo eliminar el grupo."));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Minimalist Light Mode */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>{tr("INFO DEL GRUPO")}</Text>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{tr("Cargando detalles...")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Avatar y Datos Principales */}
          <View style={styles.heroCard}>
            <Pressable
              style={styles.avatarBox}
              onPress={isUserAdmin ? handleChangePhoto : undefined}
            >
              {group?.foto_url ? (
                <Image source={{ uri: group.foto_url }} style={styles.heroAvatar} contentFit="cover" />
              ) : (
                <View style={styles.heroAvatarPlaceholder}>
                  <Text style={styles.heroAvatarLetter}>
                    {group?.nombre ? group.nombre.charAt(0).toUpperCase() : 'G'}
                  </Text>
                </View>
              )}
              {isUserAdmin && (
                <View style={styles.avatarEditBadge}>
                  <Camera size={14} color="#ffffff" />
                </View>
              )}
            </Pressable>

            {!editingInfo ? (
              <View style={styles.heroTexts}>
                <View style={styles.nameRow}>
                  <Text style={styles.groupName}>{group?.nombre}</Text>
                  {isUserAdmin && (
                    <Pressable onPress={() => setEditingInfo(true)} hitSlop={8}>
                      <Edit2 size={16} color={Colors.primary} />
                    </Pressable>
                  )}
                </View>
                {!!group?.descripcion && (
                  <Text style={styles.groupDesc}>{group.descripcion}</Text>
                )}
                {(() => {
                  const linkedProj = availableProjects.find((p) => p.id === group?.proyecto_id);
                  if (!group?.proyecto_id && !linkedProj) return null;
                  return (
                    <View style={styles.villaLinkedBadge}>
                      <Home size={13} color={Colors.primary} />
                      <Text style={styles.villaLinkedBadgeText}>
                        {linkedProj
                          ? `${linkedProj.desarrollo} · ${linkedProj.villa || linkedProj.unidad}`
                          : tr('Villa vinculada')}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View style={styles.editInputsBox}>
                <TextInput
                  style={styles.nameInput}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder={tr("Nombre...")}
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.descInput}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder={tr("Descripción...")}
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.editVillaBox}>
                  <Text style={styles.editVillaLabel}>{tr("Villa vinculada (opcional)")}</Text>
                  <TaskFilterSelect
                    label={tr("Villa vinculada")}
                    value={editProjectId || ''}
                    options={[
                      { value: '', label: tr("Ninguna (Chat general)") },
                      ...availableProjects.map((p) => ({
                        value: p.id,
                        label: `${p.desarrollo} · ${p.villa || p.unidad}`,
                      })),
                    ]}
                    onChange={(val) => setEditProjectId(val ? val : null)}
                  />
                </View>
                <View style={styles.editButtonsRow}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setNombre(group?.nombre || '');
                      setDescripcion(group?.descripcion || '');
                      setEditProjectId(group?.proyecto_id || null);
                      setEditingInfo(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>{tr("Cancelar")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.saveBtn}
                    onPress={handleSaveInfo}
                    disabled={savingInfo || !nombre.trim()}
                  >
                    {savingInfo ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveBtnText}>{tr("Guardar")}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Configuración de Admin: Modo Solo Multimedia */}
          {isUserAdmin && (
            <View style={styles.settingCard}>
              <View style={styles.settingHeader}>
                <Shield size={18} color={Colors.primary} />
                <Text style={styles.settingCardTitle}>{tr("CONTROLES DE ADMINISTRADOR")}</Text>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <View style={styles.switchTitleRow}>
                    <Video size={16} color={Colors.primary} />
                    <Text style={styles.switchTitle}>{tr("Modo Solo Multimedia")}</Text>
                  </View>
                  <Text style={styles.switchSubtitle}>{tr("Bloquea el teclado de texto para técnicos. Solo podrán enviar fotos y videos técnicos.")}</Text>
                </View>
                <Switch
                  value={group?.solo_multimedia ?? false}
                  onValueChange={handleToggleSoloMultimedia}
                  trackColor={{ false: 'rgba(52, 62, 72, 0.20)', true: Colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          )}

          {/* Sección de Archivos y Multimedia */}
          <View style={styles.mediaSection}>
            <View style={styles.mediaHeader}>
              <View style={styles.mediaTitleRow}>
                <Paperclip size={16} color={Colors.primary} />
                <Text style={styles.mediaTitle}>
                  {c.groupMedia.toUpperCase()} ({attachments.length})
                </Text>
              </View>
            </View>

            {/* Tabs de Filtro */}
            <View style={styles.mediaTabsRow}>
              {[
                { key: 'all', label: c.mediaAll },
                { key: 'media', label: c.mediaPhotos },
                { key: 'docs', label: c.mediaDocs },
                { key: 'audio', label: c.mediaAudio },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setMediaTab(tab.key as any)}
                  style={[styles.mediaTabChip, mediaTab === tab.key && styles.mediaTabChipActive]}
                >
                  <Text style={[styles.mediaTabChipText, mediaTab === tab.key && styles.mediaTabChipTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Contenido Filtrado */}
            {(() => {
              const filtered = attachments.filter((att) => {
                if (mediaTab === 'media') return att.tipo === 'imagen' || att.tipo === 'video';
                if (mediaTab === 'docs') return att.tipo === 'archivo';
                if (mediaTab === 'audio') return att.tipo === 'audio';
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <View style={styles.mediaEmptyBox}>
                    <Text style={styles.mediaEmptyText}>{c.noGroupMedia}</Text>
                  </View>
                );
              }

              return (
                <View style={styles.mediaContentBox}>
                  {/* Grid de Fotos, Videos y Documentos cuando está en 'all' o 'media' */}
                  {filtered.some((a) => a.tipo === 'imagen' || a.tipo === 'video' || (mediaTab === 'all' && a.tipo === 'archivo')) && (mediaTab === 'media' || mediaTab === 'all') && (
                    <View style={styles.mediaGrid}>
                      {filtered
                        .filter((a) => a.tipo === 'imagen' || a.tipo === 'video' || (mediaTab === 'all' && a.tipo === 'archivo'))
                        .map((att) => {
                          if (att.tipo === 'video') {
                            return (
                              <Pressable
                                key={att.id}
                                style={styles.mediaThumbBox}
                                onPress={() => {
                                  setActiveVideo({ url: att.media_url!, title: att.media_meta?.fileName || c.video });
                                }}
                              >
                                <Image source={{ uri: att.media_url! }} style={styles.mediaThumbImage} contentFit="cover" />
                                <View style={styles.mediaThumbVideoBadge}>
                                  <Play size={12} color="#FFFFFF" fill="#FFFFFF" />
                                </View>
                              </Pressable>
                            );
                          }

                          if (att.tipo === 'imagen') {
                            return (
                              <Pressable
                                key={att.id}
                                style={styles.mediaThumbBox}
                                onPress={() => {
                                  setActiveDoc({ url: att.media_url!, fileName: att.contenido || c.photo, mimeType: 'image/jpeg' });
                                }}
                              >
                                <Image source={{ uri: att.media_url! }} style={styles.mediaThumbImage} contentFit="cover" />
                              </Pressable>
                            );
                          }

                          // att.tipo === 'archivo' (en la cuadrícula tiene el mismo tamaño que los demás elementos: 31.5%)
                          const docInfo = getDocumentInfo(att.media_meta?.fileName, att.media_meta?.mimeType, att.media_url);
                          const title = att.media_meta?.fileName || att.contenido || c.document;
                          return (
                            <Pressable
                              key={att.id}
                              style={[
                                styles.mediaThumbBox,
                                styles.mediaDocThumbBox,
                                { backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor },
                              ]}
                              onPress={() => setActiveDoc({ url: att.media_url!, fileName: title, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                            >
                              <View style={styles.gridDocBadgeWrapper}>
                                <ChatDocumentBadge info={docInfo} size={36} />
                              </View>
                              <View style={[styles.gridDocFooter, { backgroundColor: docInfo.primaryColor }]}>
                                <Text numberOfLines={1} style={styles.gridDocTitle}>
                                  {title}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                    </View>
                  )}

                  {/* Lista de Documentos (pestaña 'docs') y Audios con diseño tipo web */}
                  {filtered
                    .filter((a) => (mediaTab === 'docs' && a.tipo === 'archivo') || a.tipo === 'audio')
                    .map((att) => {
                      if (att.tipo === 'audio') {
                        return (
                          <View key={att.id} style={styles.mediaDocItem}>
                            <View style={[styles.mediaDocIconBox, { backgroundColor: '#ECFDF5' }]}>
                              <Mic size={18} color="#059669" />
                            </View>
                            <View style={styles.mediaDocInfo}>
                              <Text numberOfLines={1} style={styles.mediaDocTitle}>{c.audio}</Text>
                              <Text style={styles.mediaDocMeta}>{new Date(att.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-MX')}</Text>
                            </View>
                          </View>
                        );
                      }

                      const docInfo = getDocumentInfo(att.media_meta?.fileName, att.media_meta?.mimeType, att.media_url);
                      const title = att.media_meta?.fileName || att.contenido || c.document;
                      return (
                        <View key={att.id} style={styles.mediaDocItem}>
                          <Pressable
                            style={styles.mediaDocMainClickable}
                            onPress={() => setActiveDoc({ url: att.media_url!, fileName: title, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                          >
                            <ChatDocumentBadge info={docInfo} size={38} />
                            <View style={styles.mediaDocInfo}>
                              <Text numberOfLines={1} style={styles.mediaDocTitle}>{title}</Text>
                              <Text style={styles.mediaDocMeta}>
                                {att.media_meta?.fileSize
                                  ? (att.media_meta.fileSize > 1024 * 1024
                                      ? (att.media_meta.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                                      : (att.media_meta.fileSize / 1024).toFixed(0) + ' KB')
                                  : tr(docInfo.typeName)}
                                {' · '}
                                {tr(docInfo.typeName)}
                              </Text>
                            </View>
                          </Pressable>

                          <View style={styles.mediaDocActions}>
                            <Pressable
                              style={({ pressed }) => [styles.mediaDocActionBtn, pressed && { opacity: 0.7 }]}
                              onPress={() => setActiveDoc({ url: att.media_url!, fileName: title, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                              accessibilityLabel={c.preview || tr("Vista previa")}
                            >
                              <Text style={styles.mediaDocActionBtnText}>{c.preview || tr("Vista previa")}</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.mediaDocDownloadBtn, pressed && { opacity: 0.7 }]}
                              onPress={() => void Linking.openURL(att.media_url!)}
                              accessibilityLabel={c.download || tr("Descargar archivo")}
                            >
                              <Download size={13} color="#475569" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            })()}
          </View>

          {/* Tareas realizadas de la villa vinculada */}
          {group.proyecto_id ? (
            <GroupTaskActivitySection
              groupId={group.id}
              onImage={(url) =>
                setActiveDoc({
                  url,
                  fileName: tr('Evidencia'),
                  mimeType: 'image/jpeg',
                })
              }
            />
          ) : null}

          {/* Lista de Integrantes */}
          <View style={styles.membersSection}>
            <View style={styles.membersHeader}>
              <View style={styles.membersTitleRow}>
                <Users size={16} color={Colors.primary} />
                <Text style={styles.membersTitle}>{tr("INTEGRANTES (")}{members.length})
                </Text>
              </View>

              {isUserAdmin && (
                <Pressable
                  style={({ pressed }) => [styles.addMemberBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleOpenAddModal}
                >
                  <UserPlus size={14} color="#ffffff" />
                  <Text style={styles.addMemberText}>{tr("Agregar")}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.membersList}>
              {members.map((m) => {
                const isMe = m.profile_id === profile?.id;
                const isGroupAdmin = m.rol === 'admin';
                const roleLabel = m.profiles?.rol
                  ? getRoleLabel(m.profiles.rol, tr).toUpperCase()
                  : tr('Técnico').toUpperCase();

                return (
                  <View key={m.id} style={styles.memberItem}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarLetter}>
                        {m.profiles?.nombre ? m.profiles.nombre.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>

                    <View style={styles.memberDetails}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>
                          {m.profiles?.nombre || tr('Usuario')}
                        </Text>
                        {isMe && <Text style={styles.youBadge}>{tr("Tú")}</Text>}
                      </View>
                      <Text style={styles.memberRole}>{roleLabel}</Text>
                    </View>

                    {isGroupAdmin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>{tr("Admin")}</Text>
                      </View>
                    ) : (
                      isUserAdmin &&
                      !isMe && (
                        <Pressable
                          onPress={() => handleRemoveMember(m)}
                          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                          hitSlop={8}
                        >
                          <Trash2 size={16} color={Colors.textSecondary} />
                        </Pressable>
                      )
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Acciones Destructivas */}
          {isUserAdmin && (
            <View style={styles.dangerZone}>
              <Pressable
                style={({ pressed }) => [styles.deleteGroupBtn, pressed && { opacity: 0.8 }]}
                onPress={handleDeleteGroup}
              >
                <Trash2 size={18} color={Colors.primary} />
                <Text style={styles.deleteGroupText}>{tr("Eliminar Grupo Definitivamente")}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal para Invitar Nuevos Miembros */}
      <Modal
        visible={showAddMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMembers(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddMembers(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tr("Invitar Integrantes")}</Text>
              <Pressable onPress={() => setShowAddMembers(false)} hitSlop={10}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Search size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={tr("Buscar por nombre...")}
                placeholderTextColor={Colors.textMuted}
                value={searchMemberQuery}
                onChangeText={setSearchMemberQuery}
              />
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {availableProfiles
                .filter((p) =>
                  p.nombre?.toLowerCase().includes(searchMemberQuery.toLowerCase())
                )
                .map((p) => {
                  const isSelected = selectedToAdd.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        setSelectedToAdd((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        );
                      }}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarLetter}>
                          {p.nombre ? p.nombre.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{p.nombre}</Text>
                        <Text style={styles.memberRole}>
                          {getRoleLabel(p.rol, tr).toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.confirmAddBtn,
                selectedToAdd.length === 0 && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleConfirmAddMembers}
              disabled={selectedToAdd.length === 0 || addingMembers}
            >
              {addingMembers ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmAddText}>{tr("Agregar ")}{selectedToAdd.length}{tr(" Miembros")}</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ChatDocumentPreviewModal
        visible={Boolean(activeDoc)}
        url={activeDoc?.url || null}
        fileName={activeDoc?.fileName}
        fileSize={activeDoc?.fileSize}
        mimeType={activeDoc?.mimeType}
        onClose={() => setActiveDoc(null)}
      />
      <ChatVideoPlayerModal
        visible={Boolean(activeVideo)}
        url={activeVideo?.url || null}
        title={activeVideo?.title}
        onClose={() => setActiveVideo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mediaSection: {
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    ...Shadow.xs,
  },
  mediaHeader: {
    marginBottom: 10,
  },
  mediaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  mediaTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
    marginBottom: 10,
  },
  mediaTabChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  mediaTabChipActive: {
    backgroundColor: Colors.primary,
  },
  mediaTabChipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  mediaTabChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_600SemiBold',
  },
  mediaEmptyBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaEmptyText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  mediaContentBox: {
    gap: 8,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  mediaThumbBox: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
  },
  mediaThumbVideoBadge: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  mediaDocThumbBox: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    paddingBottom: 3,
  },
  gridDocBadgeWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDocFooter: {
    width: '100%',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDocTitle: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 8.5,
    textAlign: 'center',
  },
  mediaDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mediaDocMainClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  mediaDocIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaDocInfo: {
    flex: 1,
    minWidth: 0,
  },
  mediaDocTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  mediaDocMeta: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  mediaDocActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mediaDocActionBtn: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaDocActionBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    color: '#334155',
  },
  mediaDocDownloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  villaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(247, 140, 38, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(247, 140, 38, 0.25)',
  },
  villaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  editVillaBox: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  editVillaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  villaChipsList: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  villaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  villaChipActive: {
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    borderColor: Colors.primary,
  },
  villaChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  villaChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E4E7EC',
    zIndex: 10,
    ...Shadow.xs,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: Spacing.md,
    ...Shadow.xs,
  },
  avatarBox: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
  },
  heroAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarLetter: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    color: Colors.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    height: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTexts: {
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  groupDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  villaLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignSelf: 'center',
  },
  villaLinkedBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11.5,
    color: Colors.primary,
  },
  editInputsBox: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  editVillaBox: {
    gap: 4,
    marginTop: 2,
  },
  editVillaLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  nameInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  descInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: '#ffffff',
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: Spacing.md,
    ...Shadow.xs,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  settingCardTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flex: 1,
    marginRight: 10,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: Colors.text,
  },
  switchSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  membersSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: Spacing.lg,
    ...Shadow.xs,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  membersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membersTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addMemberText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: '#ffffff',
  },
  membersList: {
    gap: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarLetter: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  memberDetails: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: Colors.text,
  },
  youBadge: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9.5,
    color: Colors.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  memberRole: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  adminBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: Colors.primary,
  },
  removeBtn: {
    padding: 6,
  },
  dangerZone: {
    marginTop: 8,
  },
  deleteGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  deleteGroupText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: '#B42318',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
    maxHeight: '75%',
    minHeight: 400,
    borderTopWidth: 1,
    borderColor: '#E4E7EC',
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: Colors.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  modalItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  confirmAddBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmAddText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: '#ffffff',
  },
});
