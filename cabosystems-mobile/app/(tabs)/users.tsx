import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ProfileNavButton } from '@/components/ProfileNavButton';
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
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import {
  UserPlus,
  Plus,
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
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
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
type TeamRow = { kind: 'collaborator'; item: Profile } | { kind: 'invitation'; item: Invitacion };
let cachedUsersData: { owner: string; users: Profile[]; invitaciones: Invitacion[]; timestamp: number } | null = null;

const usersCachePath = (owner: string) => {
  const root = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return root ? `${root}users-cache-${encodeURIComponent(owner)}.json` : null;
};

export async function readUsersDiskCache(owner: string) {
  if (!owner) return null;
  try {
    const path = usersCachePath(owner);
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(`users-cache:${owner}`)
      : path ? await FileSystem.readAsStringAsync(path) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.owner === owner && Array.isArray(parsed.users)) {
      return parsed as { owner: string; users: Profile[]; invitaciones: Invitacion[]; timestamp: number };
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeUsersDiskCache(data: { owner: string; users: Profile[]; invitaciones: Invitacion[]; timestamp: number }) {
  if (!data?.owner) return;
  try {
    const raw = JSON.stringify(data);
    if (Platform.OS === 'web') {
      localStorage.setItem(`users-cache:${data.owner}`, raw);
    } else {
      const path = usersCachePath(data.owner);
      if (path) await FileSystem.writeAsStringAsync(path, raw);
    }
  } catch {}
}

export async function preloadUsersData(owner: string) {
  if (!owner) return;
  if (!cachedUsersData || cachedUsersData.owner !== owner) {
    const saved = await readUsersDiskCache(owner);
    if (saved && (!cachedUsersData || cachedUsersData.owner !== owner)) {
      cachedUsersData = saved;
    }
  }
  if (cachedUsersData?.owner === owner && Date.now() - cachedUsersData.timestamp < 30000) return;
  try {
    const [usersRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('invitaciones')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
    ]);
    const nextData = {
      owner,
      users: (usersRes.data as Profile[]) || [],
      invitaciones: (invitesRes.data as Invitacion[]) || [],
      timestamp: Date.now(),
    };
    cachedUsersData = nextData;
    void writeUsersDiskCache(nextData);
  } catch (e) {
    console.warn('Error preloading users data:', e);
  }
}

export default function UsersScreen() {
  const { t: tr } = useInterfaceTranslation();
  const { profile } = useAuth();
  const prepared = cachedUsersData?.owner === profile?.id ? cachedUsersData : null;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [users, setUsers] = useState<Profile[]>(() => prepared?.users ?? []);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>(() => prepared?.invitaciones ?? []);
  const [loadingData, setLoadingData] = useState(() => !prepared);
  const lastFetchRef = useRef(prepared?.timestamp ?? 0);

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


  const isAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  const hasDataRef = useRef(Boolean(cachedUsersData));
  useEffect(() => {
    hasDataRef.current = users.length > 0 || invitaciones.length > 0 || Boolean(cachedUsersData);
  }, [users.length, invitaciones.length]);

  // 1. Cargar usuarios e invitaciones
  const fetchData = useCallback(async (isSilent = false) => {
    if (!profile?.id || !isAdmin) return;
    if (!isSilent && !hasDataRef.current) {
      setLoadingData(true);
    }
    try {
      const [usersRes, invitesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('invitaciones')
          .select('*')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false }),
      ]);

      const nextUsers = (usersRes.data as Profile[]) || [];
      const nextInvites = (invitesRes.data as Invitacion[]) || [];
      const nextData = { owner: profile.id, users: nextUsers, invitaciones: nextInvites, timestamp: Date.now() };
      cachedUsersData = nextData;
      void writeUsersDiskCache(nextData);
      setUsers(nextUsers);
      setInvitaciones(nextInvites);
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoadingData(false);
    }
  }, [profile?.id, isAdmin]);

  useEffect(() => {
    if (!profile?.id) return;
    if (!cachedUsersData || cachedUsersData.owner !== profile.id) {
      void readUsersDiskCache(profile.id).then(saved => {
        if (saved && (!cachedUsersData || cachedUsersData.owner !== profile.id)) {
          cachedUsersData = saved;
          setUsers(saved.users);
          setInvitaciones(saved.invitaciones);
          setLoadingData(false);
        }
      });
    }
  }, [profile?.id]);

  useEffect(() => {
    const isStale = cachedUsersData?.owner !== profile?.id || Date.now() - lastFetchRef.current > 30000;
    if (isStale) {
      fetchData(Boolean(cachedUsersData));
    }
  }, [fetchData]);

  // Filtramos solo colaboradores activos
  const activeCollaborators = useMemo(() => users.filter((u) => u.activo !== false), [users]);
  const teamRows = useMemo<TeamRow[]>(() => selectedTab === 'colaboradores'
    ? activeCollaborators.map(item => ({ kind: 'collaborator', item }))
    : invitaciones.map(item => ({ kind: 'invitation', item })), [selectedTab, activeCollaborators, invitaciones]);

  // 2. Enviar invitación
  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert(tr("Error"), tr("Ingresa un correo electrónico válido."));
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
        Alert.alert(tr("Error"), tr(error.message));
        return;
      }

      const inviteLink = `cabosystemsmobile://register?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

      setInviteEmail('');
      setInviteRoleDropdownOpen(false);
      setInviteModalVisible(false);
      await fetchData();
      setSelectedTab('invitaciones');

      Alert.alert(
        tr("¡Invitación Creada!"),
        tr("Se ha generado la invitación para {value0}.\n\n¿Deseas compartir el enlace de registro ahora?", { value0: cleanEmail }),
        [
          { text: 'Listo', style: 'cancel' },
          {
            text: tr("Compartir Enlace"),
            onPress: () => {
              Share.share({
                title: tr("Invitación a CaboSystems Field Service"),
                message: tr("Hola, has sido invitado a CaboSystems Field Service con rol de {value0}. Descarga la app y regístrate aquí: {value1}", { value0: tr(AVAILABLE_ROLES.find((r) => r.id === inviteRole)?.label || inviteRole), value1: inviteLink }),
              });
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(tr("Error"), tr(err?.message || tr("No se pudo enviar la invitación.")));
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
        Alert.alert(tr("Error"), tr("No se pudo subir la foto de perfil. Intenta de nuevo."));
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
      Alert.alert(tr("Foto Actualizada"), tr("La foto de perfil del colaborador ha sido guardada con éxito."));
    } catch (err: any) {
      console.error('Error updating collaborator avatar:', err);
      Alert.alert(tr("Error"), tr(err?.message || tr("Error al actualizar la foto de perfil.")));
    } finally {
      setUploadingEditAvatar(false);
    }
  };

  // 5. Guardar edición de colaborador
  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    if (!editNombre.trim()) {
      Alert.alert(tr("Error"), tr("El nombre completo no puede estar vacío."));
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
        Alert.alert(tr("Error"), tr(error.message));
      } else {
        setEditModalVisible(false);
        fetchData();
        Alert.alert(tr("Éxito"), tr('Datos del colaborador actualizados correctamente.'));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // 6. Expulsar / Desactivar usuario
  const handleExpelUser = (user: Profile) => {
    setConfirmModal({
      visible: true,
      title: tr("¿Desactivar Colaborador?"),
      message: tr("¿Estás seguro de que deseas desactivar a {value0}? Perderá inmediatamente el acceso al sistema.", { value0: user.nombre }),
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
          Alert.alert(tr("Error"), tr(err?.message || tr("No se pudo desactivar al colaborador.")));
        }
      },
    });
  };

  // 7. Cancelar invitación pendiente
  const handleRevokeInvite = (invite: Invitacion) => {
    setConfirmModal({
      visible: true,
      title: tr("Cancelar Invitación"),
      message: tr("¿Deseas revocar la invitación enviada a {value0}? El enlace quedará invalidado permanentemente.", { value0: invite.email }),
      confirmText: tr("Sí, Cancelar Invitación"),
      isDanger: true,
      onConfirm: async () => {
        try {
          await supabase.from('invitaciones').delete().eq('id', invite.id);
          fetchData();
        } catch (err: any) {
          Alert.alert(tr("Error"), tr(err?.message || tr("No se pudo cancelar la invitación.")));
        }
      },
    });
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <HeaderCaboSystems seamless showProjectSelector={false} showNotificationCenter={false} />
        <View style={[styles.noAccess, { paddingTop: headerHeight }]}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.noAccessText}>{tr("Acceso restringido a administradores")}</Text>
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

  const renderCollaborator = useCallback((item: Profile) => {
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
        style={({ pressed }) => [
          styles.userCard,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => openEditModal(item)}
      >
        {/* Avatar con foto o iniciales */}
        <View style={styles.avatarWrapper}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} contentFit="cover" recyclingKey={item.id} cachePolicy="memory-disk" />
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
          <Text style={styles.userRole}>{tr(roleLabel)}</Text>
        </View>

        {/* Acciones */}
        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionBtnEdit}
            accessibilityRole="button" accessibilityLabel={tr('Editar a ') + item.nombre}
            onPress={event => { event.stopPropagation(); openEditModal(item); }}
            hitSlop={8}
          >
            <Edit2 size={17} color={Colors.brandSlate} />
          </Pressable>

          <Pressable
            style={styles.actionBtnExpel}
            accessibilityRole="button" accessibilityLabel={tr('Retirar a ') + item.nombre}
            onPress={event => { event.stopPropagation(); handleExpelUser(item); }}
            hitSlop={8}
          >
            <UserX size={17} color={Colors.brandSlate} />
          </Pressable>
        </View>
      </Pressable>
    );
  }, [tr]);

  const renderInvitation = useCallback((inv: Invitacion) => (
    <View style={styles.inviteCardTailAdmin}>
      <View style={styles.inviteIconCircle}>
        <Mail size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.inviteEmail} numberOfLines={1}>
          {inv.email}
        </Text>
        <Text style={styles.inviteMeta}>{tr("Rol:")}{' '}
          <Text style={{ fontFamily: 'Outfit_600SemiBold', color: Colors.primary }}>
            {tr(AVAILABLE_ROLES.find((r) => r.id === inv.rol)?.label || inv.rol.replace('_', ' '))}
          </Text>
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <Pressable
          style={styles.iconBtn}
          accessibilityRole="button" accessibilityLabel={tr("Compartir invitación de ") + inv.email}
          onPress={() => {
            const link = `cabosystemsmobile://register?token=${inv.token}&email=${encodeURIComponent(inv.email)}`;
            Share.share({
              title: tr("Enlace de Registro"),
              message: `Completa tu registro en CaboSystems Field Service: ${link}`,
            });
          }}
          hitSlop={8}
        >
          <Share2 size={16} color={Colors.primary} />
        </Pressable>
        <Pressable
          style={[styles.iconBtn, styles.iconBtnDanger]}
          accessibilityRole="button" accessibilityLabel={tr("Cancelar invitación de ") + inv.email}
          onPress={() => handleRevokeInvite(inv)}
          hitSlop={8}
        >
          <Trash2 size={17} color={Colors.brandSlate} />
        </Pressable>
      </View>
    </View>
  ), [tr]);

  const renderTeamRow = useCallback(
    ({ item: row }: { item: TeamRow }) =>
      row.kind === 'collaborator' ? renderCollaborator(row.item) : renderInvitation(row.item),
    [renderCollaborator, renderInvitation]
  );

  const listContentStyle = useMemo(
    () => [styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 110 }],
    [headerHeight, insets.bottom]
  );

  return (
    <View style={styles.container}>
      {/* Top Navbar Minimalista con Logo Oficial CSY pegado a la izquierda */}
      <HeaderCaboSystems
        seamless
        showProjectSelector={false}
        showNotificationCenter={false}
        rightAccessory={
          isAdmin ? (
            <Pressable
              style={({ pressed }) => [styles.inviteNavBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setInviteModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={tr("Invitar")}
              hitSlop={8}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
          ) : undefined
        }
      />

      <FlashList<TeamRow>
        style={styles.scrollView}
        contentContainerStyle={listContentStyle}
        data={teamRows}
        keyExtractor={row => row.kind + '-' + row.item.id}
        getItemType={row => row.kind}
        renderItem={renderTeamRow}
        refreshControl={<RefreshControl refreshing={loadingData} onRefresh={fetchData} colors={[Colors.primary]} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View>
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
            >{tr("Equipo")}
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
            >{tr("Invitaciones (")}{invitaciones.length})
            </Text>
          </Pressable>
        </View>

</View>}
        ListEmptyComponent={
          loadingData && teamRows.length === 0 ? (
            <View style={{ paddingVertical: 48 }} />
          ) : selectedTab === 'colaboradores' ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Users size={32} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>{tr("No hay colaboradores registrados")}</Text>
                <Text style={styles.emptySubtitle}>{tr("Comienza enviando una invitación a los técnicos para sumarlos al sistema.")}</Text>
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyActionBtnText}>{tr("Invitar Primer Colaborador")}</Text>
                </Pressable>
              </View>
) : (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Clock size={32} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>{tr("No hay invitaciones pendientes")}</Text>
                <Text style={styles.emptySubtitle}>{tr("Todas las invitaciones enviadas han sido aceptadas o no hay registros pendientes.")}</Text>
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyActionBtnText}>{tr("Crear Nueva Invitación")}</Text>
                </Pressable>
              </View>
)}
      />

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
                  <Text style={styles.modalTitle}>{tr("Invitar Colaborador")}</Text>
                  <Text style={styles.modalSubtitle}>{tr("Enlace con token de acceso seguro")}</Text>
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
              <Text style={styles.fieldLabel}>{tr("CORREO ELECTRÓNICO")}</Text>
              <View style={styles.modalInputWrapper}>
                <Mail size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="name@cabosystems.com"
                  placeholderTextColor={Colors.textMuted}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!sendingInvite}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{tr("ROL ASIGNADO")}</Text>
              <Pressable
                style={styles.dropdownTrigger}
                onPress={() => setInviteRoleDropdownOpen(!inviteRoleDropdownOpen)}
                disabled={sendingInvite}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Briefcase size={16} color={Colors.primary} />
                  <Text style={styles.dropdownTriggerText}>
                    {tr(AVAILABLE_ROLES.find((r) => r.id === inviteRole)?.label || 'Seleccionar Rol')}
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
                            {tr(r.label)}
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
                    <Text style={styles.modalSubmitBtnText}>{tr("Generar y Enviar Invitación")}</Text>
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
              <Text style={styles.modalTitle}>{tr("Editar Colaborador")}</Text>
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
                  {uploadingEditAvatar ? tr('Subiendo foto...') : tr('Cambiar foto de perfil')}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>{tr("NOMBRE COMPLETO")}</Text>
            <View style={styles.modalInputWrapper}>
              <User size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                value={editNombre}
                onChangeText={setEditNombre}
                placeholder={tr("Nombre del colaborador")}
                placeholderTextColor={Colors.textMuted}
                editable={!savingEdit}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{tr("ROL ASIGNADO")}</Text>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={() => setEditRoleDropdownOpen(!editRoleDropdownOpen)}
              disabled={savingEdit}
            >
              <View style={styles.dropdownTriggerLeft}>
                <Briefcase size={16} color={Colors.primary} />
                <Text style={styles.dropdownTriggerText}>
                  {tr(AVAILABLE_ROLES.find((r) => r.id === editRol)?.label || 'Seleccionar Rol')}
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
                          {tr(r.label)}
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
                <Text style={styles.modalSubmitBtnText}>{tr("Guardar Cambios")}</Text>
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
        onRequestClose={() => { if (!confirmLoading) setConfirmModal((prev) => ({ ...prev, visible: false })); }}
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
                <Text style={styles.confirmBtnCancelText}>{tr("Cancelar")}</Text>
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
    backgroundColor: '#FFFFFF',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
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
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: '100%', maxWidth: 220, height: 54,
  },
  logoTablet: {
    width: 250,
    height: 60,
  },
  inviteNavBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 22,
  },
  scrollView: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
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
    minHeight: 84,
    paddingVertical: 18,
    gap: 12,
  },
  avatarWrapper: {
    flexShrink: 0,
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(52,62,72,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: Colors.brandSlate,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: '#000000', marginBottom: 3,
  },
  userRole: {
    fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: Colors.brandSlate,
  },
  cardActions: {
    flexDirection: 'row', gap: 0, alignItems: 'center', flexShrink: 0,
  },
  actionBtnEdit: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnExpel: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 36, paddingHorizontal: Spacing.xl, alignItems: 'center', marginVertical: Spacing.md,
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
    minHeight: 84,
    paddingVertical: 18,
    gap: 12,
  },
  inviteIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(52,62,72,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  inviteEmail: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: '#000000',
  },
  inviteMeta: {
    fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: Colors.brandSlate, marginTop: 3,
  },
  inviteActions: {
    flexDirection: 'row', gap: 0, flexShrink: 0,
  },
  iconBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: 'transparent',
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
