import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth, formatAuthError } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    token?: string;
    type?: string;
    access_token?: string;
    refresh_token?: string;
    code?: string;
    email?: string;
  }>();

  const { sendPasswordReset, signOut, session } = useAuth();

  const [email, setEmail] = useState(params.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Determinar si entramos en flujo de definir nueva clave (por link deep link, tokens o sesión activa)
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(
    Boolean(
      params.mode === 'recovery' ||
      params.type === 'recovery' ||
      params.access_token ||
      params.code ||
      session
    )
  );

  useEffect(() => {
    if (
      params.mode === 'recovery' ||
      params.type === 'recovery' ||
      params.access_token ||
      params.code ||
      session
    ) {
      setIsRecoveryFlow(true);
    }
  }, [params.mode, params.type, params.access_token, params.code, session]);

  // Si se pasaron tokens o código en los parámetros de la URL, inicializar la sesión en Supabase
  useEffect(() => {
    async function initSessionFromParams() {
      if (session) return;
      if (params.access_token && params.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        } catch (e) {
          console.warn('Error inicializando sesión de recuperación con tokens:', e);
        }
      } else if (params.code) {
        try {
          await supabase.auth.exchangeCodeForSession(params.code);
        } catch (e) {
          console.warn('Error canjeando código de recuperación:', e);
        }
      }
    }
    initSessionFromParams();
  }, [params.access_token, params.refresh_token, params.code, session]);

  // 1. Enviar correo de recuperación
  const handleSendEmail = async () => {
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Ingresa el correo electrónico asociado a tu cuenta.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await sendPasswordReset(email.trim());
      if (error) {
        setErrorMessage(error.message);
      } else {
        setEmailSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Validar código OTP de 6 dígitos ingresado manualmente
  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMessage('Ingresa el código de 6 dígitos recibido por correo.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode.trim(),
        type: 'recovery',
      });

      if (error) {
        setErrorMessage(formatAuthError(error));
      } else if (data.session) {
        setIsRecoveryFlow(true);
        setEmailSent(false);
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err?.message || 'Error al validar el código.'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  // 3. Actualizar la contraseña en Supabase Auth
  const handleUpdatePassword = async () => {
    setErrorMessage(null);
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(formatAuthError(error));
      } else {
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err?.message || 'Error al actualizar contraseña.'));
    } finally {
      setLoading(false);
    }
  };

  // 4. Cerrar sesión y volver al login tras éxito
  const handleSuccessClose = async () => {
    setShowSuccessModal(false);
    await signOut();
    router.replace('/(auth)');
  };

  const isSettingNewPassword = isRecoveryFlow || !!session;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Barra superior con botón volver fijado arriba */}
      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top + Spacing.sm, Spacing.md) },
        ]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(auth)')}
          hitSlop={8}
        >
          <ArrowLeft size={18} color={Colors.text} />
          <Text style={styles.backButtonText}>Volver al Login</Text>
        </Pressable>
      </View>

      {/* Contenedor central con la tarjeta en el medio */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>
            {isSettingNewPassword ? 'Nueva Contraseña' : '¿Olvidaste tu contraseña?'}
          </Text>
          <Text style={styles.subtitle}>
            {isSettingNewPassword
              ? 'Ingresa tu nueva clave de acceso para CaboSystems Field Service.'
              : 'Ingresa tu correo registrado y te enviaremos un enlace y código para restablecer tu clave.'}
          </Text>

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={Colors.primary} style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {emailSent ? (
            <View style={styles.successBox}>
              <CheckCircle size={36} color={Colors.primary} style={{ marginBottom: 10 }} />
              <Text style={styles.successTitle}>Correo Enviado</Text>
              <Text style={styles.successText}>
                Hemos enviado un correo a <Text style={{ fontFamily: 'Outfit_700Bold', color: Colors.text }}>{email}</Text> con las instrucciones y el código de seguridad.
              </Text>

              {/* Separador */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>O INGRESA EL CÓDIGO AQUÍ</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Formulario para ingresar código OTP de 6 dígitos directamente */}
              <View style={[styles.inputGroup, { width: '100%' }]}>
                <Text style={styles.inputLabel}>Código de seguridad (6 dígitos)</Text>
                <View style={styles.inputWrapper}>
                  <KeyRound size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { letterSpacing: 4, fontWeight: '700' }]}
                    placeholder="123456"
                    placeholderTextColor={Colors.textMuted}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!verifyingOtp}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  { width: '100%' },
                  pressed && { opacity: 0.9 },
                  verifyingOtp && { opacity: 0.7 },
                ]}
                onPress={handleVerifyOtp}
                disabled={verifyingOtp}
              >
                {verifyingOtp ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Validar Código y Continuar</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelLink}
                onPress={() => setEmailSent(false)}
              >
                <Text style={styles.cancelLinkText}>Reintentar con otro correo</Text>
              </Pressable>
            </View>
          ) : isSettingNewPassword ? (
            <>
              {/* Nueva Contraseña */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { paddingRight: 40 }]}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
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

              {/* Confirmar Nueva Contraseña */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Repite la contraseña"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && { opacity: 0.9 },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Actualizar Contraseña</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {/* Formulario de Solicitud de Correo */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Correo electrónico corporativo</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="tu-correo@csy.mx"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && { opacity: 0.9 },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleSendEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar Enlace de Recuperación</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Modal de Contraseña Actualizada con Diseño Oficial CaboSystems */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <CheckCircle size={38} color={Colors.primary} />
            </View>

            <Text style={styles.modalTitle}>¡Contraseña Actualizada!</Text>

            <Text style={styles.modalSubtitle}>
              Tu contraseña de acceso en <Text style={{ fontFamily: 'Outfit_700Bold', color: Colors.text }}>CaboSystems</Text> ha sido cambiada correctamente. Ya puedes iniciar sesión con tus nuevas credenciales.
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.modalButtonText}>Iniciar Sesión</Text>
            </Pressable>
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
  topBar: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  successTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
    marginBottom: 6,
  },
  successText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.md,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4E7EC',
  },
  dividerText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  cancelLink: {
    marginTop: Spacing.md,
    padding: 6,
  },
  cancelLinkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.text,
    paddingVertical: Spacing.md,
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
  },
  submitButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: Spacing.xl + 6,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.xl,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13.5,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
