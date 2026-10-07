import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
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
  Camera,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  X,
  Fingerprint,
  ScanFace,
  Globe,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow, Animation } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useHeaderHeight } from '@/components/HeaderCaboSystems';
import { supabase } from '@/lib/supabase';
import { pickImageSafe } from '@/lib/mediaPicker';
import { uploadAvatarImage } from '@/lib/avatarUpload';
import {
  getBiometricStatus,
  isBiometricAuthEnabled,
  getBiometricCredentials,
  setBiometricCredentials,
  authenticateWithBiometrics,
  getStoredPassword,
  setBiometricEnabled,
} from '@/lib/biometrics';

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');

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
  integrador: 'Integrador',
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
  const { profile, user, session, signOut, refreshProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Foto de perfil: Priorizar la guardada en la base de datos (profiles.avatar_url)
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

  const isAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  // Subida de Foto de Perfil
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleChangeAvatar = async () => {
    if (!user?.id) return;
    try {
      const uri = await pickImageSafe({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!uri) return;

      setUploadingAvatar(true);
      const publicUrl = await uploadAvatarImage(uri, user.id);
      if (!publicUrl) {
        Alert.alert('Error', 'No se pudo subir la foto de perfil. Intenta de nuevo.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Éxito', 'Foto de perfil actualizada correctamente.');
    } catch (err: any) {
      console.error('Error updating avatar:', err);
      Alert.alert('Error', err?.message || 'Error al actualizar foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Cambio de Contraseña
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Biometría (Huella / Face ID)
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Huella Dactilar');
  const [biometryType, setBiometryType] = useState<'fingerprint' | 'facial' | 'iris' | 'generic'>('generic');

  // Modal para confirmación de contraseña al activar biometría
  const [bioPasswordModalVisible, setBioPasswordModalVisible] = useState(false);
  const [bioConfirmPassword, setBioConfirmPassword] = useState('');
  const [showBioPassword, setShowBioPassword] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBiometrics() {
      const status = await getBiometricStatus();
      setBiometricAvailable(status.available && status.enrolled);
      setBiometricLabel(status.label);
      setBiometryType(status.biometryType);
      const isEnabled = await isBiometricAuthEnabled();
      setBiometricsEnabled(isEnabled);
    }
    loadBiometrics();
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      if (!user?.email) {
        Alert.alert('Error', 'No se pudo obtener la información de tu cuenta.');
        return;
      }

      const cleanEmail = user.email.trim().toLowerCase();

      // 1. Verificar si ya tenemos la contraseña guardada en Keystore/Keychain
      const storedPass = await getStoredPassword();
      if (storedPass) {
        // Contraseña ya disponible: Solicitar únicamente la huella/FaceID
        const auth = await authenticateWithBiometrics(`Confirma tu ${biometricLabel} para activar`);
        if (auth.success) {
          await setBiometricCredentials(cleanEmail, storedPass, true);
          setBiometricsEnabled(true);
          Alert.alert('Acceso Biométrico', `${biometricLabel} activada correctamente para inicio de sesión rápido.`);
        } else {
          setBiometricsEnabled(false);
        }
      } else {
        // Solo si nunca se ha registrado una contraseña en este dispositivo, solicitarla
        setBioConfirmPassword('');
        setBioError(null);
        setBioPasswordModalVisible(true);
      }
    } else {
      setBiometricsEnabled(false);
      await setBiometricEnabled(false);
      Alert.alert('Acceso Biométrico', 'Se ha desactivado el acceso biométrico.');
    }
  };

  const handleConfirmBioWithPassword = async () => {
    const cleanPassword = bioConfirmPassword.trim();
    if (!cleanPassword) {
      setBioError('Ingresa tu contraseña actual.');
      return;
    }
    if (!user?.email) return;
    const cleanEmail = user.email.trim().toLowerCase();

    setBioLoading(true);
    setBioError(null);
    try {
      // 1. Validar que la contraseña sea correcta contra Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        console.warn('Supabase signInWithPassword verification error:', error);
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setBioError('La contraseña ingresada no coincide con tu cuenta corporativa.');
        } else if (error.message.toLowerCase().includes('rate')) {
          setBioError('Demasiados intentos. Espera unos momentos antes de reintentar.');
        } else {
          setBioError(error.message || 'Error al validar credenciales.');
        }
        setBioLoading(false);
        return;
      }

      // 2. Solicitar confirmación del sensor biométrico
      const auth = await authenticateWithBiometrics(`Confirma tu ${biometricLabel} para vincularla`);
      if (auth.success) {
        await setBiometricCredentials(cleanEmail, cleanPassword, true);
        setBiometricsEnabled(true);
        setBioPasswordModalVisible(false);
        setBioConfirmPassword('');
        Alert.alert('Acceso Biométrico', `${biometricLabel} vinculada y activada exitosamente.`);
      } else {
        setBioError(auth.error || 'No se completó la verificación biométrica.');
      }
    } catch (err: any) {
      setBioError(err?.message || 'Error al vincular biometría.');
    } finally {
      setBioLoading(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPasswordError(error.message);
      } else {
        // Si tiene biometría activa, actualizar la credencial guardada con la nueva contraseña
        if (biometricsEnabled && user?.email) {
          await setBiometricCredentials(user.email, newPassword, true);
        }
        setPasswordModalVisible(false);
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Contraseña Actualizada', 'Tu nueva contraseña ha sido guardada exitosamente.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Error al actualizar contraseña.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const rawName =
    profile?.nombre ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    t('profile.userFallback');

  const displayName = rawName.includes('@') ? rawName.split('@')[0] : rawName;
  const initials = getInitials(displayName);
  const email = user?.email || '';
  const roleKey = profile?.rol || 'tecnico';
  const roleTitle = t(`role.${roleKey}`) || ROLE_LABELS[roleKey] || roleKey.toUpperCase();

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await signOut();
  };

  return (
    <View style={styles.container}>
      {/* Header Minimalista en Modo Claro */}
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

            <View style={[styles.profilePill, isTablet && styles.profilePillTablet]}>
              <User color="#FFFFFF" size={14} strokeWidth={2.5} />
              <Text style={styles.profilePillText}>{t('profile.title')}</Text>
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
          <Pressable
            style={styles.avatarContainer}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
          >
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

            {uploadingAvatar ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.avatarCameraBadge}>
                <Camera size={13} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            )}
          </Pressable>

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
        <Text style={styles.sectionHeading}>{t('profile.fieldOperations')}</Text>
        <View style={styles.menuGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => router.push('/(tabs)/' as any)}
          >
            <View style={styles.menuIconCircle}>
              <ClipboardList size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>{t('profile.myWorkOrders')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.myWorkOrdersSub')}</Text>
            </View>
            <ChevronRight size={17} color={Colors.textDisabled} />
          </Pressable>

          {!isAdmin && (
            <>
              <View style={styles.menuDivider} />

              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
                ]}
                onPress={() => router.push('/checkin/villa' as any)}
              >
                <View style={styles.menuIconCircle}>
                  <MapPin size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={styles.menuTitle}>{t('profile.checkinCheckout')}</Text>
                  <Text style={styles.menuSubtitle}>{t('profile.checkinCheckoutSub')}</Text>
                </View>
                <ChevronRight size={17} color={Colors.textDisabled} />
              </Pressable>
            </>
          )}
        </View>

        {/* Sección: AJUSTES DE LA APLICACIÓN */}
        <Text style={styles.sectionHeading}>{t('profile.appSettings')}</Text>
        <View style={styles.menuGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => setLanguageModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Globe size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>{t('profile.language')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.languageSub')}</Text>
            </View>
            <View style={styles.languagePillBadge}>
              <Text style={styles.languagePillText}>
                {language === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
              </Text>
            </View>
            <ChevronRight size={17} color={Colors.textDisabled} />
          </Pressable>
        </View>

        {/* Sección: SOPORTE Y SEGURIDAD */}
        <Text style={styles.sectionHeading}>{t('profile.supportSecurity')}</Text>
        <View style={styles.menuGroup}>
          {/* Opción de Acceso Biométrico */}
          {biometricAvailable && (
            <>
              <View style={styles.menuItem}>
                <View style={styles.menuIconCircle}>
                  <Fingerprint size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={styles.menuTitle}>{biometricLabel}</Text>
                  <Text style={styles.menuSubtitle}>
                    {biometricsEnabled ? t('profile.biometricEnabled') : t('profile.biometricDisabled')}
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: '#D0D5DD', true: Colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.menuDivider} />
            </>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => {
              setPasswordError(null);
              setNewPassword('');
              setConfirmPassword('');
              setPasswordModalVisible(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <KeyRound size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>{t('profile.changePassword')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.changePasswordSub')}</Text>
            </View>
            <ChevronRight size={17} color={Colors.textDisabled} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75, transform: [{ scale: Animation.pressScale }] },
            ]}
            onPress={() => setSupportModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <HelpCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>{t('profile.support')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.supportSub')}</Text>
            </View>
            <ChevronRight size={17} color={Colors.textDisabled} />
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
              <LogOut size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.logoutText}>{t('profile.logout')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.logoutSub')}</Text>
            </View>
            <ChevronRight size={17} color={Colors.textDisabled} />
          </Pressable>
        </View>

        {/* Footer Minimalista de Marca */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandFooterTitle}>CABOSYSTEMS FIELD SERVICE</Text>
          <Text style={styles.brandFooterCopy}>{t('profile.footerTagline')}</Text>
          <Text style={styles.brandFooterVersion}>{t('profile.version')}</Text>
        </View>
      </ScrollView>

      {/* Modal de Confirmación de Cerrar Sesión */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <LogOut size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.modalTitle}>{t('profile.logoutModalTitle')}</Text>
            <Text style={styles.modalMessage}>
              {t('profile.logoutModalMsg')}
            </Text>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={({ pressed }) => [ 
                  styles.modalCancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t('profile.cancel')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.modalConfirmBtnText}>{t('profile.logoutConfirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Selector de Idioma (Español / Inglés) */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.languageModalCard}>
            <View style={styles.passwordModalHeader}>
              <View style={styles.passwordHeaderLeft}>
                <View style={styles.keyIconCircle}>
                  <Globe size={20} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFormTitle}>{t('profile.selectLanguageTitle')}</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={2}>
                    {t('profile.selectLanguageSub')}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setLanguageModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.languageOptionsList}>
              {/* Opción Español */}
              <Pressable
                style={({ pressed }) => [
                  styles.languageOptionItem,
                  language === 'es' && styles.languageOptionActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={async () => {
                  await setLanguage('es');
                  setLanguageModalVisible(false);
                }}
              >
                <View style={styles.languageOptionLeft}>
                  <Text style={styles.languageFlag}>🇲🇽</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.languageOptionTitle, language === 'es' && styles.languageOptionTitleActive]}>
                      Español
                    </Text>
                    <Text style={styles.languageOptionDesc}>
                      {t('profile.langEsDesc')}
                    </Text>
                  </View>
                </View>
                {language === 'es' && (
                  <View style={styles.languageCheckCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </Pressable>

              {/* Opción Inglés */}
              <Pressable
                style={({ pressed }) => [
                  styles.languageOptionItem,
                  language === 'en' && styles.languageOptionActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={async () => {
                  await setLanguage('en');
                  setLanguageModalVisible(false);
                }}
              >
                <View style={styles.languageOptionLeft}>
                  <Text style={styles.languageFlag}>🇺🇸</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.languageOptionTitle, language === 'en' && styles.languageOptionTitleActive]}>
                      English
                    </Text>
                    <Text style={styles.languageOptionDesc}>
                      {t('profile.langEnDesc')}
                    </Text>
                  </View>
                </View>
                {language === 'en' && (
                  <View style={styles.languageCheckCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelFullBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>{t('profile.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Cambio de Contraseña  */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !updatingPassword && setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.passwordModalCard}>
            <View style={styles.passwordModalHeader}>
              <View style={styles.passwordHeaderLeft}>
                <View style={styles.keyIconCircle}>
                  <KeyRound size={20} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={styles.modalFormTitle}>Cambiar Contraseña</Text>
                  <Text style={styles.modalSubtitle}>Ingresa tu nueva clave de acceso</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setPasswordModalVisible(false)}
                disabled={updatingPassword}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {passwordError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            {/* Nueva Contraseña */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>NUEVA CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.modalTextInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!updatingPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Confirmar Contraseña */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>CONFIRMAR CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.modalTextInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!updatingPassword}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={8}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.passwordModalActions}>
              <Pressable
                style={[styles.modalCancelBtn, updatingPassword && { opacity: 0.5 }]}
                onPress={() => setPasswordModalVisible(false)}
                disabled={updatingPassword}
              >
                <Text style={styles.modalCancelBtnText}>CANCELAR</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, updatingPassword && { opacity: 0.7 }]}
                onPress={handleSavePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>GUARDAR</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para Vincular Biometría con Contraseña */}
      <Modal
        visible={bioPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !bioLoading && setBioPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.passwordModalCard}>
            <View style={styles.passwordModalHeader}>
              <View style={styles.passwordHeaderLeft}>
                <View style={styles.keyIconCircle}>
                  {biometryType === 'facial' ? (
                    <ScanFace size={20} color="#FFFFFF" strokeWidth={2.4} />
                  ) : (
                    <Fingerprint size={20} color="#FFFFFF" strokeWidth={2.4} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFormTitle}>Activar {biometricLabel}</Text>
                  <Text style={styles.modalSubtitle}>
                    Confirma tu contraseña para guardar el acceso seguro
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setBioPasswordModalVisible(false)}
                disabled={bioLoading}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {bioError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{bioError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>CONTRASEÑA ACTUAL</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.modalTextInput}
                  value={bioConfirmPassword}
                  onChangeText={(text) => {
                    setBioConfirmPassword(text);
                    if (bioError) setBioError(null);
                  }}
                  placeholder="Tu contraseña de CaboSystems"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showBioPassword}
                  autoCapitalize="none"
                  editable={!bioLoading}
                />
                <Pressable
                  onPress={() => setShowBioPassword(!showBioPassword)}
                  hitSlop={8}
                >
                  {showBioPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.passwordModalActions}>
              <Pressable
                style={[styles.modalCancelBtn, bioLoading && { opacity: 0.5 }]}
                onPress={() => setBioPasswordModalVisible(false)}
                disabled={bioLoading}
              >
                <Text style={styles.modalCancelBtnText}>CANCELAR</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, bioLoading && { opacity: 0.7 }]}
                onPress={handleConfirmBioWithPassword}
                disabled={bioLoading}
              >
                {bioLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>CONFIRMAR</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Informativo de Soporte Técnico (TailAdmin Light Mode) */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <HelpCircle size={28} color="#FFFFFF" strokeWidth={2.5} />
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
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
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  navContainerTablet: {
    height: 78,
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
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadow.xs,
  },
  profilePillTablet: {
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  profilePillText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    marginBottom: Spacing.md,
    ...Shadow.xs,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: Colors.borderBrand,
    backgroundColor: Colors.backgroundAlt,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderBrand,
  },
  avatarFallbackText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 30,
    color: Colors.primary,
    letterSpacing: 1,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Shadow.sm,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(16, 24, 40, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderBrand,
    marginBottom: 8,
  },
  roleChipText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionHeading: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
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
    ...Shadow.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
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
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 62,
  },
  logoutMenuItem: {
    backgroundColor: Colors.card,
  },
  logoutIconCircle: {
    backgroundColor: Colors.primary,
  },
  logoutText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#000000',
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
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...Shadow.lg,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  modalMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.xs,
  },
  modalConfirmBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalFullBtn: {
    width: '100%',
    height: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.xs,
  },
  modalFullBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  passwordModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadow.lg,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  passwordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  keyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  modalFormTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: BorderRadius.sm,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: BorderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#D92D20',
  },
  fieldContainer: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10.5,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  modalTextInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  passwordModalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  languagePillBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  languagePillText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  languageModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadow.lg,
  },
  languageOptionsList: {
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  languageOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#FAFAFA',
  },
  languageOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F2',
  },
  languageOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  languageFlag: {
    fontSize: 26,
  },
  languageOptionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  languageOptionTitleActive: {
    color: Colors.primary,
  },
  languageOptionDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  languageCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelFullBtn: {
    width: '100%',
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
