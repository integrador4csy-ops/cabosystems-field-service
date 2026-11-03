import { getRoleLabel } from '@/lib/localization';
import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { pickImageSafe } from '@/lib/mediaPicker';
import {
  ArrowLeft,
  Camera,
  Users,
  Search,
  Check,
  Video,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { createChatGroup, getAllProfilesForInvite } from '@/lib/chatApi';
import { getMyProjects } from '@/lib/api';
import { TaskFilterSelect } from '@/components/TaskFilterSelect';
import type { Profile, Project } from '@/types/database';

export default function NewGroupScreen() {
  const { t: tr } = useInterfaceTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [soloMultimedia, setSoloMultimedia] = useState(false);

  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Permitir a admins y supervisores, o en modo desarrollo para pruebas del equipo
    if (profile && profile.rol !== 'admin' && profile.rol !== 'supervisor_instalacion' && !__DEV__) {
      Alert.alert(tr('Acceso Restringido'), tr("Solo los administradores pueden crear grupos de trabajo."));
      router.back();
    }
  }, [profile]);

  useEffect(() => {
    loadProfiles();
    getMyProjects()
      .then(setAvailableProjects)
      .catch((err) => console.error('Error loading projects for new group:', err));
  }, []);

  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const data = await getAllProfilesForInvite();
      setAvailableProfiles(data.filter((p) => p.id !== profile?.id));
    } catch (err) {
      console.error('Error loading profiles for group:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handlePickPhoto = async () => {
    const uri = await pickImageSafe({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (uri) {
      setFotoUri(uri);
    }
  };

  const toggleSelectMember = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!nombre.trim()) {
      Alert.alert(tr("Nombre requerido"), tr("Por favor ingresa un nombre para el grupo de trabajo."));
      return;
    }

    if (!profile?.id) return;

    try {
      setCreating(true);
      const newGroup = await createChatGroup({
        nombre,
        descripcion,
        fotoUri,
        solo_multimedia: soloMultimedia,
        proyecto_id: selectedProjectId || null,
        creatorId: profile.id,
        memberIds: selectedProfileIds,
      });

      Alert.alert(tr('Grupo Creado'), tr("El grupo fue creado exitosamente."), [
        {
          text: 'Entrar al Chat',
          onPress: () => router.replace(('/chat/' + newGroup.id) as any),
        },
      ]);
    } catch (err: any) {
      console.error('Error creating group:', err);
      Alert.alert(tr("Error"), tr(err?.message || tr("Ocurrió un error al crear el grupo.")));
    } finally {
      setCreating(false);
    }
  };

  const filteredProfiles = availableProfiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.nombre?.toLowerCase().includes(q) || p.rol?.toLowerCase().includes(q) || getRoleLabel(p.rol, tr).toLowerCase().includes(q);
  });

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

          <Text style={styles.headerTitle}>{tr("NUEVO GRUPO")}</Text>

          <Pressable
            onPress={handleCreateGroup}
            disabled={creating || !nombre.trim()}
            style={({ pressed }) => [
              styles.createActionBtn,
              (!nombre.trim() || creating) && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createActionText}>{tr("Crear")}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Foto e Información Básica */}
          <View style={styles.card}>
            <View style={styles.photoRow}>
              <Pressable style={styles.photoBox} onPress={handlePickPhoto}>
                {fotoUri ? (
                  <Image source={{ uri: fotoUri }} style={styles.groupAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Camera size={26} color={Colors.primary} />
                    <Text style={styles.photoText}>{tr("FOTO")}</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.inputsColumn}>
                <TextInput
                  style={styles.nameInput}
                  placeholder={tr("Nombre del grupo...")}
                  placeholderTextColor={Colors.textMuted}
                  value={nombre}
                  onChangeText={setNombre}
                  maxLength={50}
                />
                <TextInput
                  style={styles.descInput}
                  placeholder={tr("Descripción u objetivo del grupo...")}
                  placeholderTextColor={Colors.textMuted}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  maxLength={120}
                />
              </View>
            </View>

            {/* Villa vinculada (opcional) */}
            <View style={styles.villaSection}>
              <Text style={styles.villaLabel}>{tr("Villa vinculada (opcional)")}</Text>
              <TaskFilterSelect
                label={tr("Villa vinculada")}
                value={selectedProjectId || ''}
                options={[
                  { value: '', label: tr("Ninguna (Chat general)") },
                  ...availableProjects.map((p) => ({
                    value: p.id,
                    label: `${p.desarrollo} · ${p.villa || p.unidad}`,
                  })),
                ]}
                onChange={(val) => setSelectedProjectId(val ? val : null)}
              />
              <Text style={styles.villaHint}>
                {tr("Solo puedes vincular villas que tienes permitido consultar.")}
              </Text>
            </View>

            {/* Switch de Solo Multimedia */}
            <View style={styles.switchBox}>
              <View style={styles.switchInfo}>
                <View style={styles.switchLabelRow}>
                  <Video size={16} color={Colors.primary} />
                  <Text style={styles.switchLabel}>{tr("Modo Solo Multimedia")}</Text>
                </View>
                <Text style={styles.switchDesc}>{tr("Los técnicos solo podrán enviar fotos y videos (bloquea mensajes de texto).")}</Text>
              </View>
              <Switch
                value={soloMultimedia}
                onValueChange={setSoloMultimedia}
                trackColor={{ false: 'rgba(52, 62, 72, 0.20)', true: Colors.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Selector de Miembros */}
          <View style={styles.membersSection}>
            <View style={styles.sectionHeader}>
              <Users size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{tr("INVITAR MIEMBROS (")}{selectedProfileIds.length})
              </Text>
            </View>

            {/* Buscador de usuarios */}
            <View style={styles.searchBar}>
              <Search size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={tr("Buscar por nombre o rol...")}
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Lista de Miembros */}
            {loadingProfiles ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>{tr("Cargando equipo técnico...")}</Text>
              </View>
            ) : filteredProfiles.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{tr("No se encontraron usuarios")}</Text>
              </View>
            ) : (
              <View style={styles.profilesList}>
                {filteredProfiles.map((p) => {
                  const isSelected = selectedProfileIds.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={({ pressed }) => [
                        styles.profileItem,
                        isSelected && styles.profileItemSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => toggleSelectMember(p.id)}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetter}>
                          {p.nombre ? p.nombre.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>

                      <View style={styles.profileDetails}>
                        <Text style={styles.profileName} numberOfLines={1}>
                          {p.nombre || tr("Sin nombre")}
                        </Text>
                        <Text style={styles.profileRole} numberOfLines={1}>
                          {getRoleLabel(p.rol, tr).toUpperCase()}
                        </Text>
                      </View>

                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  villaSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  villaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  villaLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  villaDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  villaChipsList: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  villaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
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
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.8,
  },
  createActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  createActionText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#ffffff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.xs,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photoBox: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
  },
  groupAvatar: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: 2,
  },
  photoText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9,
    color: Colors.primary,
  },
  inputsColumn: {
    flex: 1,
    gap: 8,
  },
  nameInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  villaSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#E4E7EC',
    gap: 6,
  },
  villaLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  villaHint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#E4E7EC',
  },
  switchInfo: {
    flex: 1,
    marginRight: 10,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: Colors.text,
  },
  switchDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  membersSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    ...Shadow.xs,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: Colors.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13.5,
  },
  profilesList: {
    gap: 8,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    gap: 12,
    ...Shadow.xs,
  },
  profileItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7ED',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: Colors.text,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  profileRole: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
