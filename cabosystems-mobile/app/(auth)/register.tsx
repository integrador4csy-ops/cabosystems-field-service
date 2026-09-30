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
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  User,
  Mail,
  Lock,
  Camera,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import CaboLogo from '@/components/CaboLogo';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { uploadAvatarImage } from '@/lib/avatarUpload';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [token, setToken] = useState(params.token || '');
  const [email, setEmail] = useState(params.email || '');
  const [role, setRole] = useState('aux_instalacion');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { signUpWithInvitation } = useAuth();

  // 1. Validar el token de invitación si viene en parámetros
  useEffect(() => {
    if (params.token) {
      validateInvitation(params.token);
    }
  }, [params.token]);

  const validateInvitation = async (inputToken: string) => {
    if (!inputToken.trim()) return;
    setValidatingToken(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('token', inputToken.trim())
        .eq('estado', 'pendiente')
        .single();

      if (error || !data) {
        setTokenValid(false);
        setErrorMessage('El enlace de invitación no es válido o ya fue utilizado.');
      } else {
        setTokenValid(true);
        setEmail(data.email);
        setRole(data.rol || 'aux_instalacion');
        setToken(data.token);
      }
    } catch (err: any) {
      setTokenValid(false);
      setErrorMessage(err?.message || 'Error al validar la invitación.');
    } finally {
      setValidatingToken(false);
    }
  };

  // 2. Selección de foto de perfil
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso Requerido',
          'Se necesita acceso a la galería para seleccionar tu foto de perfil.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error selecting image:', err);
    }
  };

  // 3. Envío del formulario de registro
  const handleRegister = async () => {
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage('Ingresa o valida el código de tu invitación.');
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      let finalAvatarUrl: string | null = null;

      // Subir avatar si el usuario eligió uno
      if (avatarUri) {
        // Generamos un id temporal para la ruta de storage
        const tempId = `temp_${Date.now()}`;
        finalAvatarUrl = await uploadAvatarImage(avatarUri, tempId);
      }

      const { error } = await signUpWithInvitation(
        token.trim(),
        email.trim(),
        password,
        fullName.trim(),
        finalAvatarUrl
      );

      if (error) {
        setErrorMessage(error.message);
      } else {
        setShowSuccessModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Botón Volver */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(auth)')}
          hitSlop={8}
        >
          <ArrowLeft size={18} color={Colors.text} />
          <Text style={styles.backButtonText}>Volver al Login</Text>
        </Pressable>

        <View style={styles.logoContainer}>
          <CaboLogo width={180} textColor={Colors.text} />
          <Text style={styles.logoSubtext}>REGISTRO DE PERSONAL</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Completa tu Perfil</Text>
          <Text style={styles.subtitle}>
            Personaliza tus datos de colaborador para el sistema de campo.
          </Text>

          {/* Error Message */}
          {!!errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={Colors.primary} style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Campo para validar Token si no vino en el link */}
          {!tokenValid && (
            <View style={styles.tokenSection}>
              <Text style={styles.inputLabel}>Código o Token de Invitación</Text>
              <View style={styles.tokenInputRow}>
                <TextInput
                  style={[styles.textInput, styles.tokenInput]}
                  placeholder="Pega aquí tu código de invitación"
                  placeholderTextColor={Colors.textMuted}
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                />
                <Pressable
                  style={[styles.validateBtn, validatingToken && { opacity: 0.6 }]}
                  onPress={() => validateInvitation(token)}
                  disabled={validatingToken}
                >
                  {validatingToken ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.validateBtnText}>Validar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Formulario completo si el token es válido */}
          {tokenValid && (
            <>
              {/* Badge de Invitación Verificada */}
              <View style={styles.verifiedBadge}>
                <CheckCircle size={16} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifiedText}>Invitación confirmada</Text>
                  <Text style={styles.verifiedSubtext}>
                    {email} · Rol: <Text style={{ textTransform: 'capitalize' }}>{role.replace('_', ' ')}</Text>
                  </Text>
                </View>
              </View>

              {/* Selector de Foto de Perfil */}
              <View style={styles.avatarSection}>
                <Pressable style={styles.avatarWrapper} onPress={handlePickImage}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <User size={36} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <Camera size={14} color="#ffffff" />
                  </View>
                </Pressable>
                <Pressable onPress={handlePickImage} hitSlop={6}>
                  <Text style={styles.changePhotoText}>
                    {avatarUri ? 'Cambiar foto' : 'Elegir foto de perfil'}
                  </Text>
                </Pressable>
              </View>

              {/* Nombre Completo */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre completo</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej. Juan Pérez"
                    placeholderTextColor={Colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Contraseña */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Crea tu contraseña</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { paddingRight: 40 }]}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
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

              {/* Confirmar Contraseña */}
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

              {/* Botón Finalizar Registro */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Completar Registro</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Modal de Registro Exitoso con Diseño Oficial CaboSystems */}
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

            <Text style={styles.modalTitle}>¡Registro Completado!</Text>

            <Text style={styles.modalSubtitle}>
              Tu cuenta de colaborador en <Text style={{ fontFamily: 'Outfit_700Bold', color: Colors.text }}>CaboSystems</Text> ha sido activada exitosamente. Ya puedes gestionar tus órdenes de trabajo y visitas técnicas.
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/(tabs)');
              }}
            >
              <Text style={styles.modalButtonText}>Comenzar</Text>
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  backButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoSubtext: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 3,
    marginTop: Spacing.sm,
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
  tokenSection: {
    marginBottom: Spacing.md,
  },
  tokenInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  tokenInput: {
    flex: 1,
  },
  validateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: Spacing.lg,
  },
  verifiedText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.success,
  },
  verifiedSubtext: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarWrapper: {
    position: 'relative',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'visible',
    marginBottom: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
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
    marginTop: Spacing.md,
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
