import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Share,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Edit2,
  Clock,
  X,
  Share2,
  UserCheck,
  UserX,
  AlertTriangle,
  User,
  Users,
  Briefcase,
  ChevronDown,
  Check,
  Camera,
  Send,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow, Animation } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { pickImageSafe } from '@/lib/mediaPicker';
import { uploadAvatarImage } from '@/lib/avatarUpload';
import type { Profile } from '@/types/database';

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');

interface Invitacion {
  id: string;
  email: string;
  rol: string;
  token: string;
  estado: string;
  created_at: string;
}

const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'supervisor_instalacion', label: 'Supervisor Instalación' },
  { id: 'instalador', label: 'Técnico Instalador' },
  { id: 'aux_instalacion', label: 'Auxiliar Instalación' },
  { id: 'integrador', label: 'Integrador' },
  { id: 'aux_integracion', label: 'Auxiliar Integración' },
  { id: 'infraestructura', label: 'Infraestructura' },
  { id: 'aux_infraestructura', label: 'Auxiliar Infraestructura' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'aux_servicios', label: 'Auxiliar Servicios' },
  { id: 'aux_operaciones', label: 'Auxiliar Operaciones' },
];

type TabType = 'colaboradores' | 'invitaciones';

export default function UsersScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [users, setUsers] = useState<Profile[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Navegación por Cápsulas
  const [selectedTab, setSelectedTab] = useState<TabType>('colaboradores');

  // Modales
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Modales
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Formulario Invitar
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');
  const [inviteRoleDropdownOpen, setInviteRoleDropdownOpen] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Formulario Editar Colaborador
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('');
  const [editRoleDropdownOpen, setEditRoleDropdownOpen] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal de Confirmación Corporativo
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    isDanger: true,
    onConfirm: () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const { profile } = useAuth();

  const isAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  // 1. Cargar usuarios e invitaciones
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('invitaciones')
          .select('*')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false }),
      ]);

      if (usersRes.data) setUsers(usersRes.data as Profile[]);
      if (invitesRes.data) setInvitaciones(invitesRes.data as Invitacion[]);
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtramos solo colaboradores activos
  const activeCollaborators = users.filter((u) => u.activo !== false);

  // 2. Enviar invitación
  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Error', 'Ingresa un correo electrónico válido.');
      return;
    }

    setSendingInvite(true);
    try {
      const cleanEmail = inviteEmail.trim().toLowerCase();

      // Generar token único
      const token = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const { error } = await supabase
        .from('invitaciones')
        .insert({
          email: cleanEmail,
          rol: inviteRole,
          token,
          creado_por: profile?.id,
          estado: 'pendiente',
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      const inviteLink = `cabosystemsmobile://register?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

      setInviteEmail('');
      setInviteRoleDropdownOpen(false);
      setInviteModalVisible(false);
      await fetchData();
      setSelectedTab('invitaciones');

      Alert.alert(
        '¡Invitación Creada!',
        `Se ha generado la invitación para ${cleanEmail}.\n\n¿Deseas compartir el enlace de registro ahora?`,
        [
          { text: 'Listo', style: 'cancel' },
          {
            text: 'Compartir Enlace',
            onPress: () => {
              Share.share({
                title: 'Invitación a CaboSystems Field Service',
                message: `Hola, has sido invitado a CaboSystems Field Service con rol de ${AVAILABLE_ROLES.find((r) => r.id === inviteRole)?.label || inviteRole}. Descarga la app y regístrate aquí: ${inviteLink}`,
              });
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo enviar la invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  // 3. Abrir modal de edición
  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setEditNombre(user.nombre);
    setEditRol(user.rol);
    setEditAvatarUrl(user.avatar_url || null);
    setEditRoleDropdownOpen(false);
    setEditModalVisible(true);
  };

  // 4. Cambiar foto de perfil del colaborador (como Admin)
  const handleEditCollaboratorAvatar = async () => {
    if (!selectedUser) return;
    try {
      const uri = await pickImageSafe({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!uri) return;

      setUploadingEditAvatar(true);
      const publicUrl = await uploadAvatarImage(uri, selectedUser.id);
      if (!publicUrl) {
        Alert.alert('Error', 'No se pudo subir la foto de perfil. Intenta de nuevo.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setEditAvatarUrl(publicUrl);
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, avatar_url: publicUrl } : u))
      );
      Alert.alert('Foto Actualizada', 'La foto de perfil del colaborador ha sido guardada con éxito.');
    } catch (err: any) {
      console.error('Error updating collaborator avatar:', err);
      Alert.alert('Error', err?.message || 'Error al actualizar la foto de perfil.');
    } finally {
      setUploadingEditAvatar(false);
    }
  };

  // 5. Guardar edición de colaborador
  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    if (!editNombre.trim()) {
      Alert.alert('Error', 'El nombre completo no puede estar vacío.');
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editNombre.trim(),
          rol: editRol,
          avatar_url: editAvatarUrl,
        })
        .eq('id', selectedUser.id);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setEditModalVisible(false);
        fetchData();
        Alert.alert('Éxito', 'Datos del colaborador actualizados correctamente.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // 6. Expulsar / Desactivar usuario
  const handleExpelUser = (user: Profile) => {
    setConfirmModal({
      visible: true,
      title: '¿Desactivar Colaborador?',
      message: `¿Estás seguro de que deseas desactivar a ${user.nombre}? Perderá inmediatamente el acceso al sistema.`,
      confirmText: 'Desactivar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const { error: rpcErr } = await supabase.rpc('expulsar_usuario', {
            target_user_id: user.id,
          });

          if (rpcErr) {
            await supabase
              .from('profiles')
              .update({ activo: false })
              .eq('id', user.id);
            await supabase
              .from('ubicaciones_usuarios')
              .delete()
              .eq('usuario_id', user.id);
          }

          fetchData();
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'No se pudo desactivar al colaborador.');
        }
      },
    });
  };

  // 7. Cancelar invitación pendiente
  const handleRevokeInvite = (invite: Invitacion) => {
    setConfirmModal({
      visible: true,
      title: 'Cancelar Invitación',
      message: `¿Deseas revocar la invitación enviada a ${invite.email}? El enlace quedará invalidado permanentemente.`,
      confirmText: 'Sí, Cancelar Invitación',
      isDanger: true,
      onConfirm: async () => {
        try {
          await supabase.from('invitaciones').delete().eq('id', invite.id);
          fetchData();
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'No se pudo cancelar la invitación.');
        }
      },
    });
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.headerWrapper}>
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={[styles.navContainer, isTablet && styles.navContainerTablet]}>
              <View style={styles.logoGroup}>
                <Image
                  source={LOGO_DARK}
                  style={[styles.logo, isTablet && styles.logoTablet]}
                  contentFit="contain"
                  contentPosition="left center"
                  priority="high"
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.noAccessText}>Acceso restringido a administradores</Text>
        </View>
      </View>
    );
  }

  const editInitials =
    (editNombre || selectedUser?.nombre || 'CS')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'CS';

  return (
    <View style={styles.container}>
      {/* Top Navbar Minimalista con Logo Oficial CSY pegado a la izquierda */}
      <View style={styles.headerWrapper}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.navContainer, isTablet && styles.navContainerTablet]}>
            <View style={styles.logoGroup}>
              <Image
                source={LOGO_DARK}
                style={[styles.logo, isTablet && styles.logoTablet]}
                contentFit="contain"
                contentPosition="left center"
                priority="high"
              />
            </View>

            {isAdmin && (
              <Pressable
                style={({ pressed }) => [styles.inviteNavBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setInviteModalVisible(true)}
                hitSlop={8}
              >
                <UserPlus size={15} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.inviteNavBtnText}>Invitar</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Spacing.md, paddingBottom: 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loadingData}
            onRefresh={fetchData}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado Principal */}
        <View style={styles.headerArea}>
          <Text style={styles.pageTitle}>Gestión de Personal</Text>
          <Text style={styles.pageSubtitle}>
            {selectedTab === 'colaboradores'
              ? `${activeCollaborators.length} colaboradores activos en la plataforma`
              : `${invitaciones.length} invitaciones pendientes de registro`}
          </Text>
        </View>

        {/* Separación por Cápsulas (TailAdmin Light Mode - Ambas visibles sin deslizar) */}
        <View style={styles.filterPillsContainer}>
          {/* Cápsula 1: Colaboradores */}
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              selectedTab === 'colaboradores' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setSelectedTab('colaboradores')}
          >
            <Users
              size={14}
              color={selectedTab === 'colaboradores' ? '#FFFFFF' : Colors.textSecondary}
              strokeWidth={2.2}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedTab === 'colaboradores' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              Colaboradores ({activeCollaborators.length})
            </Text>
          </Pressable>

          {/* Cápsula 2: Invitaciones Pendientes */}
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              selectedTab === 'invitaciones' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setSelectedTab('invitaciones')}
          >
            <Clock
              size={14}
              color={selectedTab === 'invitaciones' ? '#FFFFFF' : Colors.textSecondary}
              strokeWidth={2.2}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedTab === 'invitaciones' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              Invitaciones ({invitaciones.length})
            </Text>
          </Pressable>
        </View>

        {/* CONTENIDO DE CÁPSULA 1: COLABORADORES */}
        {selectedTab === 'colaboradores' && (
          <View>
            {activeCollaborators.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Users size={32} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>No hay colaboradores registrados</Text>
                <Text style={styles.emptySubtitle}>
                  Comienza enviando una invitación a los técnicos para sumarlos al sistema.
                </Text>
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyActionBtnText}>Invitar Primer Colaborador</Text>
                </Pressable>
              </View>
            ) : (
              activeCollaborators.map((item) => {
                const initials =
                  item.nombre
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'CS';

                const roleLabel =
                  AVAILABLE_ROLES.find((r) => r.id === item.rol)?.label ||
                  item.rol.replace('_', ' ').toUpperCase();

                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.userCard,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => openEditModal(item)}
                  >
                    {/* Avatar con foto o iniciales */}
                    <View style={styles.avatarWrapper}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} contentFit="cover" />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                      )}
                    </View>

                    {/* Información */}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.userRole}>{roleLabel}</Text>
                    </View>

                    {/* Acciones */}
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.actionBtnEdit}
                        onPress={() => openEditModal(item)}
                        hitSlop={8}
                      >
                        <Edit2 size={16} color={Colors.text} />
                      </Pressable>

                      <Pressable
                        style={styles.actionBtnExpel}
                        onPress={() => handleExpelUser(item)}
                        hitSlop={8}
                      >
                        <UserX size={16} color={Colors.error} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* CONTENIDO DE CÁPSULA 2: INVITACIONES PENDIENTES */}
        {selectedTab === 'invitaciones' && (
          <View>
            {invitaciones.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Clock size={32} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>No hay invitaciones pendientes</Text>
                <Text style={styles.emptySubtitle}>
                  Todas las invitaciones enviadas han sido aceptadas o no hay registros pendientes.
                </Text>
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyActionBtnText}>Crear Nueva Invitación</Text>
                </Pressable>
              </View>
            ) : (
              invitaciones.map((inv) => (
                <View key={inv.id} style={styles.inviteCardTailAdmin}>
                  <View style={styles.inviteIconCircle}>
                    <Mail size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteEmail} numberOfLines={1}>
                      {inv.email}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      Rol:{' '}
                      <Text style={{ fontFamily: 'Outfit_600SemiBold', color: Colors.primary }}>
                        {AVAILABLE_ROLES.find((r) => r.id === inv.rol)?.label || inv.rol.replace('_', ' ')}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => {
                        const link = `cabosystemsmobile://register?token=${inv.token}&email=${encodeURIComponent(inv.email)}`;
                        Share.share({
                          title: 'Enlace de Registro',
                          message: `Completa tu registro en CaboSystems Field Service: ${link}`,
                        });
                      }}
                      hitSlop={8}
                    >
                      <Share2 size={16} color={Colors.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, styles.iconBtnDanger]}
                      onPress={() => handleRevokeInvite(inv)}
                      hitSlop={8}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal: Invitar Nuevo Colaborador */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sendingInvite) {
            setInviteModalVisible(false);
            setInviteRoleDropdownOpen(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formIconCircle}>
                  <UserPlus size={20} color={Colors.primary} strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Invitar Colaborador</Text>
                  <Text style={styles.modalSubtitle}>Enlace con token de acceso seguro</Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteRoleDropdownOpen(false);
                }}
                disabled={sendingInvite}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
              <View style={styles.modalInputWrapper}>
                <Mail size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="ejemplo@cabosystems.com"
                  placeholderTextColor={Colors.textMuted}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!sendingInvite}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>ROL ASIGNADO</Text>
              <Pressable
                style={styles.dropdownTrigger}
                onPress={() => setInviteRoleDropdownOpen(!inviteRoleDropdownOpen)}
                disabled={sendingInvite}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Briefcase size={16} color={Colors.primary} />
                  <Text style={styles.dropdownTriggerText}>
                    {AVAILABLE_ROLES.find((r) => r.id === inviteRole)?.label || 'Seleccionar Rol'}
                  </Text>
                </View>
                <ChevronDown
                  size={18}
                  color={Colors.textSecondary}
                  style={inviteRoleDropdownOpen && { transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>

              {inviteRoleDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    {AVAILABLE_ROLES.map((r) => {
                      const isSelected = inviteRole === r.id;
                      return (
                        <Pressable
                          key={r.id}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => {
                            setInviteRole(r.id);
                            setInviteRoleDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {r.label}
                          </Text>
                          {isSelected && <Check size={16} color={Colors.primary} strokeWidth={2.5} />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <Pressable
                style={[
                  styles.modalSubmitBtn,
                  { marginTop: Spacing.xl },
                  sendingInvite && { opacity: 0.7 },
                ]}
                onPress={handleSendInvite}
                disabled={sendingInvite}
              >
                {sendingInvite ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Send size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.modalSubmitBtnText}>Generar y Enviar Invitación</Text>
                  </View>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Colaborador (Incluye cambio de foto de perfil) */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingEdit && !uploadingEditAvatar) {
            setEditModalVisible(false);
            setEditRoleDropdownOpen(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Colaborador</Text>
              <Pressable
                onPress={() => {
                  setEditModalVisible(false);
                  setEditRoleDropdownOpen(false);
                }}
                disabled={savingEdit || uploadingEditAvatar}
                hitSlop={8}
              >
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Avatar interactivo para cambiar foto de perfil */}
            <View style={styles.modalAvatarSection}>
              <Pressable
                style={styles.modalAvatarContainer}
                onPress={handleEditCollaboratorAvatar}
                disabled={uploadingEditAvatar || savingEdit}
              >
                {editAvatarUrl ? (
                  <Image
                    source={{ uri: editAvatarUrl }}
                    style={styles.modalAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.modalAvatarFallback}>
                    <Text style={styles.modalAvatarFallbackText}>{editInitials}</Text>
                  </View>
                )}

                {uploadingEditAvatar ? (
                  <View style={styles.modalAvatarLoading}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.modalAvatarBadge}>
                    <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={handleEditCollaboratorAvatar}
                disabled={uploadingEditAvatar || savingEdit}
                style={styles.changePhotoBtn}
              >
                <Camera size={13} color={Colors.primary} strokeWidth={2.2} />
                <Text style={styles.changePhotoText}>
                  {uploadingEditAvatar ? 'Subiendo foto...' : 'Cambiar foto de perfil'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
            <View style={styles.modalInputWrapper}>
              <User size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                value={editNombre}
                onChangeText={setEditNombre}
                placeholder="Nombre del colaborador"
                placeholderTextColor={Colors.textMuted}
                editable={!savingEdit}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>ROL ASIGNADO</Text>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setEditRoleDropdownOpen(!editRoleDropdownOpen)}
              disabled={savingEdit}
            >
              <View style={styles.dropdownTriggerLeft}>
                <Briefcase size={16} color={Colors.primary} />
                <Text style={styles.dropdownTriggerText}>
                  {AVAILABLE_ROLES.find((r) => r.id === editRol)?.label || 'Seleccionar Rol'}
                </Text>
              </View>
              <ChevronDown
                size={18}
                color={Colors.textSecondary}
                style={editRoleDropdownOpen && { transform: [{ rotate: '180deg' }] }}
              />
            </Pressable>

            {editRoleDropdownOpen && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = editRol === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setEditRol(r.id);
                          setEditRoleDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {r.label}
                        </Text>
                        {isSelected && <Check size={16} color={Colors.primary} strokeWidth={2.5} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Pressable
              style={[
                styles.modalSubmitBtn,
                { marginTop: Spacing.xl },
                savingEdit && { opacity: 0.7 },
              ]}
              onPress={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Guardar Cambios</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmación Corporativa */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => !confirmLoading && setConfirmModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBadge}>
              <AlertTriangle size={32} color={Colors.error} />
            </View>

            <Text style={styles.confirmTitle}>{confirmModal.title}</Text>
            <Text style={styles.confirmMessage}>{confirmModal.message}</Text>

            <View style={styles.confirmActionsRow}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                disabled={confirmLoading}
                onPress={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnAction, confirmLoading && { opacity: 0.7 }]}
                disabled={confirmLoading}
                onPress={async () => {
                  setConfirmLoading(true);
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal((prev) => ({ ...prev, visible: false }));
                  } finally {
                    setConfirmLoading(false);
                  }
                }}
              >
                {confirmLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnActionText}>{confirmModal.confirmText}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
    zIndex: 10,
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: Spacing.md,
    height: 72,
    minHeight: 72,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  navContainerTablet: {
    height: 78,
    minHeight: 78,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xl,
  },
  logoGroup: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: 220,
    height: 54,
  },
  logoTablet: {
    width: 250,
    height: 60,
  },
  inviteNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: BorderRadius.full,
    gap: 5,
    ...Shadow.xs,
  },
  inviteNavBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  noAccessText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
  headerArea: {
    marginBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  pageTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
    width: '100%',
  },
  filterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14.5,
    color: Colors.text,
    marginBottom: 2,
  },
  userRole: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtnEdit: {
    padding: 7,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnExpel: {
    padding: 7,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 36,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginVertical: Spacing.md,
    ...Shadow.xs,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  emptyTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  emptyActionBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  inviteCardTailAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    ...Shadow.xs,
  },
  inviteIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  inviteEmail: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: Colors.text,
  },
  inviteMeta: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 7,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBtnDanger: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  inviteFormCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  formIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  formTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    color: Colors.text,
  },
  formSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalAvatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  modalAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.borderBrand,
    backgroundColor: Colors.backgroundAlt,
  },
  modalAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderBrand,
  },
  modalAvatarFallbackText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    color: Colors.primary,
  },
  modalAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Shadow.sm,
  },
  modalAvatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 24, 40, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  changePhotoText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  fieldLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 12,
    height: 48,
  },
  modalInput: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.text,
    height: '100%',
    paddingVertical: 0,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownTriggerText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13.5,
    color: Colors.text,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginTop: 4,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.text,
  },
  dropdownItemTextSelected: {
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.primary,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.xs,
  },
  modalSubmitBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.lg,
  },
  confirmIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  confirmMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.xl,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmBtnCancelText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  confirmBtnAction: {
    backgroundColor: Colors.error,
  },
  confirmBtnActionText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
