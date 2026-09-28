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
import { BlurView } from 'expo-blur';
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
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { createChatGroup, getAllProfilesForInvite } from '@/lib/chatApi';
import type { Profile } from '@/types/database';

export default function NewGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [soloMultimedia, setSoloMultimedia] = useState(false);

  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Permitir a admins y supervisores, o en modo desarrollo para pruebas del equipo
    if (profile && profile.rol !== 'admin' && profile.rol !== 'supervisor_instalacion' && !__DEV__) {
      Alert.alert('Acceso Restringido', 'Solo los administradores pueden crear grupos de trabajo.');
      router.back();
    }
  }, [profile]);

  useEffect(() => {
    loadProfiles();
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
      Alert.alert('Nombre requerido', 'Por favor ingresa un nombre para el grupo de trabajo.');
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
        creatorId: profile.id,
        memberIds: selectedProfileIds,
      });

      Alert.alert('Grupo Creado', 'El grupo fue creado exitosamente.', [
        {
          text: 'Entrar al Chat',
          onPress: () => router.replace(('/chat/' + newGroup.id) as any),
        },
      ]);
    } catch (err: any) {
      console.error('Error creating group:', err);
      Alert.alert('Error', err?.message || 'Ocurrió un error al crear el grupo.');
    } finally {
      setCreating(false);
    }
  };

  const filteredProfiles = availableProfiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.nombre?.toLowerCase().includes(q) || p.rol?.toLowerCase().includes(q);
  });

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

          <Text style={styles.headerTitle}>NUEVO GRUPO</Text>

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
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.createActionText}>Crear</Text>
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
                    <Text style={styles.photoText}>FOTO</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.inputsColumn}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Nombre del grupo..."
                  placeholderTextColor={Colors.textMuted}
                  value={nombre}
                  onChangeText={setNombre}
                  maxLength={50}
                />
                <TextInput
                  style={styles.descInput}
                  placeholder="Descripción u objetivo del grupo..."
                  placeholderTextColor={Colors.textMuted}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  maxLength={120}
                />
              </View>
            </View>

            {/* Switch de Solo Multimedia */}
            <View style={styles.switchBox}>
              <View style={styles.switchInfo}>
                <View style={styles.switchLabelRow}>
                  <Video size={16} color={Colors.primary} />
                  <Text style={styles.switchLabel}>Modo Solo Multimedia</Text>
                </View>
                <Text style={styles.switchDesc}>
                  Los técnicos solo podrán enviar fotos y videos (bloquea mensajes de texto).
                </Text>
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
              <Text style={styles.sectionTitle}>
                INVITAR MIEMBROS ({selectedProfileIds.length})
              </Text>
            </View>

            {/* Buscador de usuarios */}
            <View style={styles.searchBar}>
              <Search size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre o rol..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Lista de Miembros */}
            {loadingProfiles ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Cargando equipo técnico...</Text>
              </View>
            ) : filteredProfiles.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No se encontraron usuarios</Text>
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
                          {p.nombre || 'Sin nombre'}
                        </Text>
                        <Text style={styles.profileRole} numberOfLines={1}>
                          {p.rol ? p.rol.toUpperCase().replace(/_/g, ' ') : 'TÉCNICO'}
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
    fontSize: 14,
    color: Colors.textWhite,
    letterSpacing: 1.5,
  },
  createActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  createActionText: {
    fontFamily: 'Montserrat_700Bold',
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
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    backgroundColor: 'rgba(247, 140, 38, 0.10)',
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9,
    color: Colors.primary,
  },
  inputsColumn: {
    flex: 1,
    gap: 8,
  },
  nameInput: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  descInput: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.08)',
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  switchDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 15,
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
  },
  profilesList: {
    gap: 8,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    gap: 12,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  profileItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(247, 140, 38, 0.06)',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(52, 62, 72, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: Colors.text,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  profileRole: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 62, 72, 0.3)',
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
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
