import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { AlertCircle, Mail, Lock, Eye, EyeOff, Fingerprint, ScanFace } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth, formatAuthError } from '@/lib/auth';

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');
import {
  getBiometricStatus,
  getBiometricCredentials,
  setBiometricCredentials,
  authenticateWithBiometrics,
  performBiometricLogin,
  BiometricStatus,
} from '@/lib/biometrics';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [hasSavedBiometrics, setHasSavedBiometrics] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);

  const { signInWithEmail, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = height < 700 || width < 360;
  const logoWidth = Math.min(width * 0.55, 220);

  // Inicializar verificación de hardware biométrico y credenciales guardadas
  useEffect(() => {
    async function initBiometrics() {
      const status = await getBiometricStatus();
      setBiometricStatus(status);

      if (status.available && status.enrolled) {
        const saved = await getBiometricCredentials();
        if (saved && saved.email && (saved.password || saved.refreshToken)) {
          setHasSavedBiometrics(true);
          setSavedEmail(saved.email);
          if (!email) {
            setEmail(saved.email);
          }
        }
      }
    }
    initBiometrics();
  }, []);

  const handleLogin = async () => {
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) {
        setLocalError(formatAuthError(error));
      } else {
        // Guardar credenciales de forma segura para permitir acceso biométrico
        if (biometricStatus?.available && biometricStatus?.enrolled) {
          await setBiometricCredentials(email.trim(), password.trim(), true);
          setHasSavedBiometrics(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegisterBiometrics = async () => {
    if (!tempCredentials) {
      setShowRegisterModal(false);
      return;
    }

    setPromptLoading(true);
    try {
      const authResult = await authenticateWithBiometrics(
        `Registrar ${biometricStatus?.label || 'biometría'} en CaboSystems`
      );

      if (authResult.success) {
        await setBiometricCredentials(tempCredentials.email, tempCredentials.password, true);
        setHasSavedBiometrics(true);
        setSavedEmail(tempCredentials.email);
      }
    } finally {
      setPromptLoading(false);
      setShowRegisterModal(false);
    }
  };

  const handleDeclineRegisterBiometrics = () => {
    setShowRegisterModal(false);
  };

  const handleBiometricLogin = async () => {
    setLocalError(null);
    clearAuthError();

    setBiometricLoading(true);
    try {
      const result = await performBiometricLogin(signInWithEmail);
      if (!result.success && result.error) {
        setLocalError(result.error);
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const displayedError = localError ? formatAuthError(localError) : (authError ? formatAuthError(authError) : null);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.logoContainer, isCompact && styles.logoContainerCompact]}>
          <Image
            source={LOGO_DARK}
            style={{ width: logoWidth, height: logoWidth * (54 / 220) }}
            contentFit="contain"
            priority="high"
          />
        </View>

        <View style={styles.formContainer}>
          <Text style={[styles.welcomeTitle, isCompact && styles.welcomeTitleCompact]}>
            Iniciar Sesión
          </Text>
          <Text style={[styles.welcomeSubtitle, isCompact && styles.welcomeSubtitleCompact]}>
            Accede con tus credenciales corporativas para gestionar visitas y tareas de campo.
          </Text>

          {/* Mensaje de Error */}
          {!!displayedError && (
            <Pressable
              style={styles.errorBox}
              onPress={() => {
                setLocalError(null);
                clearAuthError();
              }}
            >
              <AlertCircle size={20} color={Colors.primary} strokeWidth={2.2} style={styles.errorIcon} />
              <View style={styles.errorTexts}>
                <Text style={styles.errorTitle}>Error de acceso</Text>
                <Text style={styles.errorMessage}>{displayedError}</Text>
              </View>
            </Pressable>
          )}

          {/* Input Correo */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="ejemplo@csy.mx"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (displayedError) {
                    setLocalError(null);
                    clearAuthError();
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Input Contraseña */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <Pressable
                onPress={() => router.push('/(auth)/reset-password' as any)}
                hitSlop={8}
              >
                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            </View>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { paddingRight: 40 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (displayedError) {
                    setLocalError(null);
                    clearAuthError();
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <Pressable
                style={styles.eyeButton}
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

          {/* Botón Iniciar Sesión */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Iniciar Sesión</Text>
            )}
          </Pressable>

          {/* Botón Circular de Ícono Biométrico (Huella o Face ID) abajo de Login */}
          {hasSavedBiometrics && (
            <View style={styles.biometricIconWrapper}>
              <Pressable
                style={({ pressed }) => [
                  styles.biometricCircleBtn,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
                  (loading || biometricLoading) && { opacity: 0.5 },
                ]}
                onPress={handleBiometricLogin}
                disabled={loading || biometricLoading}
                hitSlop={8}
                accessibilityLabel={`Ingresar con ${biometricStatus?.label || 'Huella'}`}
                accessibilityRole="button"
              >
                {biometricLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : biometricStatus?.biometryType === 'facial' ? (
                  <ScanFace size={28} color={Colors.primary} strokeWidth={2.2} />
                ) : (
                  <Fingerprint size={28} color={Colors.primary} strokeWidth={2.2} />
                )}
              </Pressable>
            </View>
          )}

          {/* Enlace para Invitación / Registro */}
          <View style={styles.inviteNoticeContainer}>
            <Text style={styles.inviteNoticeText}>
              ¿Recibiste una invitación por correo?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/register' as any)}>
              <Text style={styles.inviteNoticeLink}>Completar registro aquí</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modal para Registrar Biometría tras Login Exitoso */}
      <Modal
        visible={showRegisterModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeclineRegisterBiometrics}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadow.lg]}>
            <View style={styles.modalIconCircle}>
              {biometricStatus?.biometryType === 'facial' ? (
                <ScanFace size={28} color="#FFFFFF" strokeWidth={2.3} />
              ) : (
                <Fingerprint size={28} color="#FFFFFF" strokeWidth={2.3} />
              )}
            </View>

            <Text style={styles.modalTitle}>
              ¿Activar {biometricStatus?.label || 'Huella Dactilar'}?
            </Text>
            <Text style={styles.modalMessage}>
              Registra tu {biometricStatus?.label?.toLowerCase() || 'huella'} para acceder rápidamente a CaboSystems Field Service en tus próximas sesiones sin escribir tu contraseña.
            </Text>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalDeclineBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleDeclineRegisterBiometrics}
                disabled={promptLoading}
              >
                <Text style={styles.modalDeclineBtnText}>Ahora no</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalAcceptBtn,
                  pressed && { opacity: 0.9 },
                  promptLoading && { opacity: 0.6 },
                ]}
                onPress={handleConfirmRegisterBiometrics}
                disabled={promptLoading}
              >
                {promptLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalAcceptBtnText}>Activar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl + 16,
    paddingBottom: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  contentCompact: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 12,
    paddingBottom: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoContainerCompact: {
    marginTop: 0,
    marginBottom: Spacing.lg,
  },
  logoSubtext: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11.5,
    color: Colors.primary,
    letterSpacing: 2,
    marginTop: 4,
  },
  formContainer: {
    marginBottom: Spacing.xl,
  },
  welcomeTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  welcomeTitleCompact: {
    fontSize: 22,
  },
  welcomeSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 19,
  },
  welcomeSubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: Spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(247, 140, 38, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 140, 38, 0.40)',
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorTexts: {
    flex: 1,
  },
  errorTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 2,
  },
  errorMessage: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPasswordText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.primary,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13.5,
    color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  biometricIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  biometricCircleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inviteNoticeContainer: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteNoticeText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  inviteNoticeLink: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
    textDecorationLine: 'underline',
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
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
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
    lineHeight: 19,
    marginBottom: 22,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalDeclineBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeclineBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  modalAcceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  modalAcceptBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
