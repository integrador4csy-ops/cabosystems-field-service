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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import {
  getChatGroupDetails,
  getGroupMembers,
  updateChatGroup,
  addChatGroupMembers,
  removeChatGroupMember,
  deleteChatGroup,
  getAllProfilesForInvite,
} from '@/lib/chatApi';
import type { ChatGroup, ChatMember, Profile } from '@/types/database';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edición rápida de Admin
  const [editingInfo, setEditingInfo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

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
      const [grp, mems] = await Promise.all([
        getChatGroupDetails(id, profile.id),
        getGroupMembers(id),
      ]);
      setGroup(grp);
      setMembers(mems);
      if (grp) {
        setNombre(grp.nombre);
        setDescripcion(grp.descripcion || '');
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
        Alert.alert('Éxito', 'Foto del grupo actualizada.');
      } catch (err) {
        console.error('Error updating group photo:', err);
        Alert.alert('Error', 'No se pudo actualizar la foto.');
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
      Alert.alert('Error', 'No se pudo cambiar la configuración multimedia.');
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
      });
      setEditingInfo(false);
      await loadData();
      Alert.alert('Éxito', 'Información del grupo actualizada.');
    } catch (err) {
      console.error('Error updating group info:', err);
      Alert.alert('Error', 'No se pudo guardar la información.');
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
      Alert.alert('Éxito', 'Nuevos miembros agregados al grupo.');
    } catch (err) {
      console.error('Error adding members:', err);
      Alert.alert('Error', 'No se pudieron agregar los miembros.');
    } finally {
      setAddingMembers(false);
    }
  };

  // Expulsar miembro
  const handleRemoveMember = (member: ChatMember) => {
    if (!isUserAdmin || !id) return;
    if (member.profile_id === profile?.id) {
      Alert.alert('Acción no permitida', 'No puedes expulsarte a ti mismo del grupo.');
      return;
    }

    Alert.alert(
      'Expulsar Integrante',
      `¿Deseas remover a "${member.profiles?.nombre || 'este usuario'}" del grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeChatGroupMember(id, member.profile_id);
              await loadData();
            } catch (err) {
              console.error('Error removing member:', err);
              Alert.alert('Error', 'No se pudo remover al miembro.');
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
      'Eliminar Grupo',
      `¿Estás seguro de que deseas eliminar definitivamente el grupo "${group?.nombre}"? Esta acción borrará todos los mensajes y no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteChatGroup(id);
              Alert.alert('Grupo Eliminado', 'El grupo fue eliminado con éxito.');
              router.replace('/(tabs)/chat');
            } catch (err) {
              console.error('Error deleting group:', err);
              Alert.alert('Error', 'No se pudo eliminar el grupo.');
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
      {/* Header Glass CSY */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <ArrowLeft size={22} color={Colors.textWhite} />
          </Pressable>

          <Text style={styles.headerTitle}>INFO DEL GRUPO</Text>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando detalles...</Text>
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
              </View>
            ) : (
              <View style={styles.editInputsBox}>
                <TextInput
                  style={styles.nameInput}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Nombre..."
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.descInput}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="Descripción..."
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.editButtonsRow}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setNombre(group?.nombre || '');
                      setDescripcion(group?.descripcion || '');
                      setEditingInfo(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.saveBtn}
                    onPress={handleSaveInfo}
                    disabled={savingInfo || !nombre.trim()}
                  >
                    {savingInfo ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Guardar</Text>
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
                <Text style={styles.settingCardTitle}>CONTROLES DE ADMINISTRADOR</Text>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <View style={styles.switchTitleRow}>
                    <Video size={16} color={Colors.primary} />
                    <Text style={styles.switchTitle}>Modo Solo Multimedia</Text>
                  </View>
                  <Text style={styles.switchSubtitle}>
                    Bloquea el teclado de texto para técnicos. Solo podrán enviar fotos y videos técnicos.
                  </Text>
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

          {/* Lista de Integrantes */}
          <View style={styles.membersSection}>
            <View style={styles.membersHeader}>
              <View style={styles.membersTitleRow}>
                <Users size={16} color={Colors.primary} />
                <Text style={styles.membersTitle}>
                  INTEGRANTES ({members.length})
                </Text>
              </View>

              {isUserAdmin && (
                <Pressable
                  style={({ pressed }) => [styles.addMemberBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleOpenAddModal}
                >
                  <UserPlus size={14} color="#ffffff" />
                  <Text style={styles.addMemberText}>Agregar</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.membersList}>
              {members.map((m) => {
                const isMe = m.profile_id === profile?.id;
                const isGroupAdmin = m.rol === 'admin';
                const roleLabel = m.profiles?.rol
                  ? m.profiles.rol.toUpperCase().replace(/_/g, ' ')
                  : 'TÉCNICO';

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
                          {m.profiles?.nombre || 'Usuario'}
                        </Text>
                        {isMe && <Text style={styles.youBadge}>Tú</Text>}
                      </View>
                      <Text style={styles.memberRole}>{roleLabel}</Text>
                    </View>

                    {isGroupAdmin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
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
                <Text style={styles.deleteGroupText}>Eliminar Grupo Definitivamente</Text>
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
              <Text style={styles.modalTitle}>Invitar Integrantes</Text>
              <Pressable onPress={() => setShowAddMembers(false)} hitSlop={10}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Search size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre..."
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
                          {p.rol ? p.rol.toUpperCase().replace(/_/g, ' ') : 'TÉCNICO'}
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
                <Text style={styles.confirmAddText}>
                  Agregar {selectedToAdd.length} Miembros
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  headerWrapper: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 10,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.textWhite,
    letterSpacing: 1.5,
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
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    marginBottom: Spacing.md,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarLetter: {
    fontFamily: 'Montserrat_700Bold',
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  groupDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  editInputsBox: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  nameInput: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  descInput: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
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
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  saveBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#ffffff',
  },
  settingCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    marginBottom: Spacing.md,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  settingCardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1,
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  switchSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  membersSection: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    marginBottom: Spacing.lg,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 1,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  addMemberText: {
    fontFamily: 'Montserrat_700Bold',
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
    backgroundColor: 'rgba(52, 62, 72, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarLetter: {
    fontFamily: 'Montserrat_700Bold',
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
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  youBadge: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9,
    color: Colors.primary,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberRole: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(247, 140, 38, 0.3)',
  },
  adminBadgeText: {
    fontFamily: 'Montserrat_700Bold',
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
    backgroundColor: 'rgba(52, 62, 72, 0.06)',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.18)',
  },
  deleteGroupText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.md,
    maxHeight: '75%',
    minHeight: 400,
    borderTopWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
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
    borderRadius: BorderRadius.sm,
  },
  modalItemSelected: {
    backgroundColor: 'rgba(247, 140, 38, 0.08)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 62, 72, 0.3)',
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
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmAddText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
});
