import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  X,
  Share2,
  UserCheck,
  UserX,
  AlertTriangle,
} from 'lucide-react-native';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

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
  { id: 'integrador', label: 'Especialista Integrador' },
  { id: 'aux_integracion', label: 'Auxiliar Integración' },
  { id: 'infraestructura', label: 'Infraestructura' },
  { id: 'aux_infraestructura', label: 'Auxiliar Infraestructura' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'aux_servicios', label: 'Auxiliar Servicios' },
  { id: 'aux_operaciones', label: 'Auxiliar Operaciones' },
];

export default function UsersScreen() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modales
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Formulario Invitar
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Formulario Editar
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal de Confirmación Corporativo (Reemplaza native alert)
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
  const headerHeight = useHeaderHeight();

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

      const { data, error } = await supabase
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

      setInviteModalVisible(false);
      setInviteEmail('');
      fetchData();

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
                message: `Hola, has sido invitado a CaboSystems Field Service con rol de ${inviteRole}. Descarga la app y regístrate aquí: ${inviteLink}`,
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
    setEditActivo(user.activo);
    setEditModalVisible(true);
  };

  // 4. Guardar edición de usuario
  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editNombre.trim(),
          rol: editRol,
          activo: editActivo,
        })
        .eq('id', selectedUser.id);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setEditModalVisible(false);
        fetchData();
        Alert.alert('Éxito', 'Datos de usuario actualizados correctamente.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // 5. Expulsar / Desactivar usuario
  const handleExpelUser = (user: Profile) => {
    setConfirmModal({
      visible: true,
      title: '¿Expulsar Usuario?',
      message: `¿Estás seguro de que deseas desactivar a ${user.nombre}? Perderá inmediatamente el acceso al sistema.`,
      confirmText: 'Expulsar / Desactivar',
      isDanger: true,
      onConfirm: async () => {
        try {
          // Intentar con RPC expulsar_usuario
          const { error: rpcErr } = await supabase.rpc('expulsar_usuario', {
            target_user_id: user.id,
          });

          if (rpcErr) {
            // Si el RPC no está aún en Supabase, hacer update directo
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
          Alert.alert('Error', err?.message || 'No se pudo expulsar al usuario.');
        }
      },
    });
  };

  // 6. Cancelar invitación pendiente
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
        <HeaderCaboSystems projects={[]} />
        <View style={[styles.noAccess, { paddingTop: headerHeight + Spacing.md }]}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.noAccessText}>Acceso restringido a administradores</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderCaboSystems projects={[]} />

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingBottom: 90,
        }}
        refreshing={loadingData}
        onRefresh={fetchData}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.pageTitle}>Control de Personal</Text>
                <Text style={styles.pageSubtitle}>
                  {users.length} colaboradores registrados
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setInviteModalVisible(true)}
              >
                <UserPlus size={16} color="#ffffff" />
                <Text style={styles.inviteBtnText}>Invitar</Text>
              </Pressable>
            </View>

            {/* Sección de Invitaciones Pendientes */}
            {invitaciones.length > 0 && (
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeaderRow}>
                  <Clock size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>
                    INVITACIONES PENDIENTES ({invitaciones.length})
                  </Text>
                </View>
                {invitaciones.map((inv) => (
                  <View key={inv.id} style={styles.inviteCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inviteEmail}>{inv.email}</Text>
                      <Text style={styles.inviteMeta}>
                        Rol asignado:{' '}
                        <Text style={{ fontWeight: '700', color: Colors.primary }}>
                          {inv.rol.replace('_', ' ')}
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
                            message: `Completa tu registro en CaboSystems: ${link}`,
                          });
                        }}
                      >
                        <Share2 size={16} color={Colors.primary} />
                      </Pressable>
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() => handleRevokeInvite(inv)}
                      >
                        <Trash2 size={16} color={Colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
              COLABORADORES ({users.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const initials = item.nombre
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'CS';

          return (
            <View style={[styles.userCard, !item.activo && styles.userCardInactive]}>
              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: item.activo ? Colors.primary + '25' : '#94a3b825' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: item.activo ? Colors.primary : Colors.textMuted },
                      ]}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: item.activo ? Colors.success : Colors.error },
                  ]}
                />
              </View>

              {/* Info */}
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <Text
                    style={[
                      styles.statusPill,
                      item.activo ? styles.statusPillActive : styles.statusPillInactive,
                    ]}
                  >
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                <Text style={styles.userRole}>
                  {item.rol.replace('_', ' ').toUpperCase()}
                </Text>
              </View>

              {/* Botones de Control Total */}
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.actionBtnEdit}
                  onPress={() => openEditModal(item)}
                  hitSlop={6}
                >
                  <Edit2 size={16} color={Colors.text} />
                </Pressable>

                {item.activo ? (
                  <Pressable
                    style={styles.actionBtnExpel}
                    onPress={() => handleExpelUser(item)}
                    hitSlop={6}
                  >
                    <UserX size={16} color={Colors.error} />
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.actionBtnActivate}
                    onPress={async () => {
                      await supabase
                        .from('profiles')
                        .update({ activo: true })
                        .eq('id', item.id);
                      fetchData();
                    }}
                    hitSlop={6}
                  >
                    <UserCheck size={16} color={Colors.success} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Modal: Invitar Usuario */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invitar Colaborador</Text>
              <Pressable onPress={() => setInviteModalVisible(false)}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Se enviará una invitación a su correo con el enlace para registrarse en la app.
            </Text>

            <Text style={styles.fieldLabel}>Correo Electrónico</Text>
            <View style={styles.modalInputWrapper}>
              <Mail size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                placeholder="ejemplo@csy.mx"
                placeholderTextColor={Colors.textMuted}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Rol Asignado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChipsScroll}>
              <View style={styles.roleChipsRow}>
                {AVAILABLE_ROLES.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[
                      styles.roleChip,
                      inviteRole === r.id && styles.roleChipSelected,
                    ]}
                    onPress={() => setInviteRole(r.id)}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        inviteRole === r.id && styles.roleChipTextSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable
              style={[styles.modalSubmitBtn, sendingInvite && { opacity: 0.7 }]}
              onPress={handleSendInvite}
              disabled={sendingInvite}
            >
              {sendingInvite ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Generar y Enviar Invitación</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Usuario */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Colaborador</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Nombre Completo</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputSingle]}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholder="Nombre del técnico"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Rol</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChipsScroll}>
              <View style={styles.roleChipsRow}>
                {AVAILABLE_ROLES.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[
                      styles.roleChip,
                      editRol === r.id && styles.roleChipSelected,
                    ]}
                    onPress={() => setEditRol(r.id)}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        editRol === r.id && styles.roleChipTextSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Estatus de la cuenta</Text>
              <Pressable
                style={[
                  styles.toggleBtn,
                  editActivo ? styles.toggleBtnActive : styles.toggleBtnInactive,
                ]}
                onPress={() => setEditActivo(!editActivo)}
              >
                <Text style={styles.toggleBtnText}>
                  {editActivo ? 'Activo / Permitido' : 'Inactivo / Bloqueado'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.modalSubmitBtn, savingEdit && { opacity: 0.7 }]}
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

      {/* Modal: Confirmación Corporativa (Reemplaza native alert) */}
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
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  noAccessText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
  headerArea: {
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pageTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  pageSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  inviteBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  sectionBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  inviteEmail: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  inviteMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userCardInactive: {
    opacity: 0.6,
    borderColor: Colors.error + '40',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  userName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    flexShrink: 1,
  },
  statusPill: {
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: Colors.success,
  },
  statusPillInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: Colors.error,
  },
  userRole: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtnEdit: {
    padding: 7,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnExpel: {
    padding: 7,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  actionBtnActivate: {
    padding: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  fieldLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 6,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 10,
  },
  modalInputSingle: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  roleChipsScroll: {
    marginBottom: Spacing.md,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  roleChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  roleChipSelected: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  roleChipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  roleChipTextSelected: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  toggleBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  modalSubmitBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  // Modal Confirmación Corporativo
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#132238',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  confirmIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  confirmMessage: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  confirmBtnCancelText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.textMuted,
  },
  confirmBtnAction: {
    backgroundColor: Colors.error,
    elevation: 3,
  },
  confirmBtnActionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
});
