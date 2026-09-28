import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import {
  User,
  Mail,
  Briefcase,
  MapPin,
  ClipboardList,
  LogOut,
  ChevronRight,
  HelpCircle,
  Check,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Animation } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useHeaderHeight } from '@/components/HeaderCaboSystems';

const LOGO_URL = 'https://csy.mx/wp-content/uploads/2024/03/Logo-CSY-Cabo-Systems-White-Hz.svg';

function getInitials(name: string): string {
  if (!name) return 'CS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador General',
  supervisor_instalacion: 'Supervisor de Instalación',
  instalador: 'Técnico Instalador',
  aux_instalacion: 'Auxiliar de Instalación',
  integrador: 'Especialista Integrador',
  aux_integracion: 'Auxiliar de Integración',
  infraestructura: 'Técnico de Infraestructura',
  aux_infraestructura: 'Auxiliar de Infraestructura',
  servicios: 'Técnico de Servicios',
  aux_servicios: 'Auxiliar de Servicios',
  aux_operaciones: 'Auxiliar de Operaciones',
  supervisor: 'Supervisor Operativo',
  tecnico: 'Técnico de Campo',
};

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Foto de perfil: Priorizar la guardada en la base de datos (profiles.avatar_url) antes de metadata de registro
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const rawName =
    profile?.nombre ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Técnico CaboSystems';

  // Si el nombre registrado es un correo electrónico, mostrar el alias antes del @
  const displayName = rawName.includes('@') ? rawName.split('@')[0] : rawName;
  const initials = getInitials(displayName);
  const email = user?.email || '';
  const roleKey = profile?.rol || 'tecnico';
  const roleTitle = ROLE_LABELS[roleKey] || roleKey.toUpperCase();

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await signOut();
  };

  return (
    <View style={styles.container}>
      {/* Header Glass CSY idéntico al de Tareas y Agenda */}
      <View style={styles.headerWrapper}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
        <View style={styles.overlayBackground} />

        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.navContainer, isTablet && styles.navContainerTablet]}>
            <View style={styles.logoGroup}>
              <Image
                source={{ uri: LOGO_URL }}
                style={[styles.logo, isTablet && styles.logoTablet]}
                contentFit="contain"
                priority="high"
              />
              <Text style={[styles.logoSubtext, isTablet && styles.logoSubtextTablet]}>Field Service</Text>
            </View>

            <View style={[styles.profilePill, isTablet && styles.profilePillTablet]}>
              <User color={Colors.primary} size={15} strokeWidth={2.5} />
              <Text style={styles.profilePillText}>Mi perfil</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Tarjeta de Identidad del Usuario */}
        <View style={styles.identityCard}>
          <View style={styles.avatarContainer}>
            {avatarUrl && !imageError ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={300}
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initials}</Text>
              </View>
            )}
            <View style={styles.googleVerifiedBadge}>
              <Check size={12} color={Colors.textWhite} strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>

          {/* Chip de Rol Operativo */}
          <View style={styles.roleChip}>
            <Briefcase size={12} color={Colors.primary} strokeWidth={2.2} />
            <Text style={styles.roleChipText}>{roleTitle}</Text>
          </View>

          {/* Fila de Correo Electrónico */}
          {!!email && (
            <View style={styles.emailRow}>
              <Mail size={13} color={Colors.textMuted} />
              <Text style={styles.emailText} numberOfLines={1}>
                {email}
              </Text>
            </View>
          )}
        </View>

        {/* Sección: OPERACIÓN EN CAMPO */}
        <Text style={styles.sectionHeading}>OPERACIÓN EN CAMPO</Text>
        <View style={styles.menuGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => router.push('/(tabs)/' as any)}
          >
            <View style={styles.menuIconCircle}>
              <ClipboardList size={18} color={Colors.primary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>Mis Tareas y Órdenes</Text>
              <Text style={styles.menuSubtitle}>Consultar asignaciones activas en villa</Text>
            </View>
            <ChevronRight size={18} color={Colors.borderDark} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => router.push('/checkin/villa' as any)}
          >
            <View style={styles.menuIconCircle}>
              <MapPin size={18} color={Colors.primary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>Registrar Check-In / Salida</Text>
              <Text style={styles.menuSubtitle}>Captura fotográfica y coordenadas satelitales</Text>
            </View>
            <ChevronRight size={18} color={Colors.borderDark} />
          </Pressable>
        </View>

        {/* Sección: SOPORTE Y SEGURIDAD */}
        <Text style={styles.sectionHeading}>SOPORTE Y SEGURIDAD</Text>
        <View style={styles.menuGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => setSupportModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <HelpCircle size={18} color={Colors.primary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>Soporte Operativo CSY</Text>
              <Text style={styles.menuSubtitle}>Ayuda técnica y reportes en campo</Text>
            </View>
            <ChevronRight size={18} color={Colors.borderDark} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              styles.logoutMenuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => setLogoutModalVisible(true)}
          >
            <View style={[styles.menuIconCircle, styles.logoutIconCircle]}>
              <LogOut size={18} color={Colors.primary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
              <Text style={styles.menuSubtitle}>Salir de tu cuenta en este dispositivo</Text>
            </View>
            <ChevronRight size={18} color={Colors.primary} />
          </Pressable>
        </View>

        {/* Footer Brand con Versión al final */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandFooterTitle}>CABOSYSTEMS FIELD SERVICE</Text>
          <Text style={styles.brandFooterCopy}>Tecnología e Integración Residencial • Los Cabos, B.C.S.</Text>
          <Text style={styles.brandFooterVersion}>Versión 1.0.0 (Native)</Text>
        </View>
      </ScrollView>

      {/* Modal de Confirmación de Cerrar Sesión (Estilo CaboSystems) */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <LogOut size={30} color={Colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.modalTitle}>¿Cerrar Sesión?</Text>
            <Text style={styles.modalMessage}>
              Al salir, se suspenderá la sincronización de campo hasta que vuelvas a iniciar sesión con tu cuenta de Google.
            </Text>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>CANCELAR</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.modalConfirmBtnText}>SALIR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Informativo de Soporte Técnico */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <HelpCircle size={30} color={Colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.modalTitle}>Soporte CaboSystems</Text>
            <Text style={styles.modalMessage}>
              Para asistencia técnica de acceso, fallas de sincronización o asignación de villas, contacta al centro de operaciones o a tu supervisor de turno.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.modalFullBtn,
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => setSupportModalVisible(false)}
            >
              <Text style={styles.modalFullBtnText}>ENTENDIDO</Text>
            </Pressable>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  navContainerTablet: {
    paddingVertical: 12,
  },
  logoGroup: {
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 30,
  },
  logoTablet: {
    width: 140,
    height: 32,
  },
  logoSubtext: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 2,
  },
  logoSubtextTablet: {
    fontSize: 9,
    letterSpacing: 3,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  profilePillTablet: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  profilePillText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
  identityCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundAlt,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarFallbackText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: Colors.textWhite,
    letterSpacing: 1,
  },
  googleVerifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: Colors.card,
  },
  userName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}35`,
    marginBottom: 8,
  },
  roleChipText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  sectionHeading: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  menuGroup: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${Colors.primary}12`,
    borderWidth: 1,
    borderColor: `${Colors.primary}25`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTexts: {
    flex: 1,
  },
  menuTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  menuSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 62,
  },
  logoutMenuItem: {
    backgroundColor: Colors.card,
  },
  logoutIconCircle: {
    backgroundColor: `${Colors.primary}15`,
    borderColor: `${Colors.primary}35`,
  },
  logoutText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  brandFooterTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  brandFooterCopy: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  brandFooterVersion: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161c22',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#343e48',
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(247, 140, 38, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 140, 38, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modalMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: Spacing.xs,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343e48',
    backgroundColor: 'rgba(52, 62, 72, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: '#cbd5e1',
    letterSpacing: 0.8,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.textWhite,
    letterSpacing: 1,
  },
  modalFullBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFullBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: Colors.textWhite,
    letterSpacing: 1,
  },
});


