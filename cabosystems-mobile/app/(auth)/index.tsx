import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import CaboLogo from '@/components/CaboLogo';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth, formatAuthError } from '@/lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { signInWithEmail, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCompact = height < 700 || width < 360;
  const logoWidth = Math.min(width * 0.55, 220);

  const handleLogin = async () => {
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setLocalError(formatAuthError(error));
      }
    } finally {
      setLoading(false);
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
          <CaboLogo width={logoWidth} textColor={Colors.text} />
          <Text style={styles.logoSubtext}>FIELD SERVICES</Text>
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
    paddingVertical: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  contentCompact: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoContainerCompact: {
    marginBottom: Spacing.xl,
  },
  logoSubtext: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 4,
    marginTop: Spacing.md,
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
});
