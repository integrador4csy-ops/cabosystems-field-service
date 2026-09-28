import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import {
  X,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { isNativeWebViewAvailable } from '@/lib/dailyForm';
import DailyFormConfirmModal from '@/components/DailyFormConfirmModal';

let CachedWebViewComponent: any = null;
function getSafeWebViewComponent(): any {
  if (CachedWebViewComponent) return CachedWebViewComponent;
  if (!isNativeWebViewAvailable()) return null;
  try {
    const mod = require('react-native-webview');
    CachedWebViewComponent = mod.WebView || mod.default || mod;
    return CachedWebViewComponent;
  } catch (err) {
    console.warn('Could not dynamically load react-native-webview:', err);
    return null;
  }
}

// Script inyectado para detectar automáticamente cuando el usuario presiona "Enviar" en Google Forms
const INJECTED_SUBMIT_DETECTOR = `
  (function() {
    function checkSubmission() {
      var bodyText = document.body ? document.body.innerText : '';
      if (
        window.location.href.includes('formResponse') ||
        window.location.href.includes('closedform') ||
        window.location.href.includes('already_responded') ||
        bodyText.includes('Se ha registrado tu respuesta') ||
        bodyText.includes('Your response has been recorded') ||
        bodyText.includes('Se registró tu respuesta') ||
        document.querySelector('.freebirdFormviewResponseConfirmContent')
      ) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FORM_COMPLETED' }));
        }
      }
    }
    setInterval(checkSubmission, 400);
    checkSubmission();
  })();
  true;
`;

interface DailyFormModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function DailyFormModal({
  visible,
  url,
  onClose,
  onComplete,
}: DailyFormModalProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const [webViewFailed, setWebViewFailed] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Estados de modales estilizados CaboSystems
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const SafeWebView = useMemo(() => getSafeWebViewComponent(), [visible]);

  const markCompletedAndNotify = () => {
    if (hasCompleted) return;
    setHasCompleted(true);
    onComplete();
    setSuccessModalVisible(true);
  };

  const handleNavigationStateChange = (navState: any) => {
    const currentUrl = (navState.url || '').toLowerCase();
    if (
      (currentUrl.includes('formresponse') ||
        currentUrl.includes('closedform') ||
        currentUrl.includes('already_responded')) &&
      !hasCompleted
    ) {
      markCompletedAndNotify();
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'FORM_COMPLETED' && !hasCompleted) {
        markCompletedAndNotify();
      }
    } catch {
      // Ignorar mensajes no-JSON
    }
  };

  const handleOpenExternal = async () => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#161c22',
        controlsColor: Colors.primary,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
      // Al regresar del navegador se despliega el modal estilo CaboSystems en el siguiente ciclo
      setTimeout(() => {
        setConfirmModalVisible(true);
      }, 150);
    } catch (e) {
      console.error('Error opening browser:', e);
    }
  };

  const handleConfirmSubmit = () => {
    setConfirmModalVisible(false);
    onComplete();
    setSuccessModalVisible(true);
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        {/* Encabezado Oficial CaboSystems (Dark Glassmorphism) */}
        <View style={styles.headerWrapper}>
          <BlurView tint="dark" intensity={75} style={StyleSheet.absoluteFill} />
          <View style={styles.headerOverlay} />

          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.badge}>
                <ShieldCheck size={13} color={Colors.primary} strokeWidth={2.5} />
                <Text style={styles.badgeText}>OPERACIÓN DIARIA</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                Formulario de Campo
              </Text>
            </View>

            <View style={styles.headerActions}>
              {SafeWebView && !webViewFailed && (
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => webViewRef.current?.reload?.()}
                  hitSlop={8}
                >
                  <RotateCw size={17} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                onPress={onClose}
                hitSlop={8}
              >
                <X size={19} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Contenedor Principal: WebView Embebido a Pantalla Completa o Fallback */}
        <View style={[styles.webContainer, { paddingBottom: insets.bottom }]}>
          {SafeWebView && !webViewFailed ? (
            <SafeWebView
              ref={webViewRef}
              source={{ uri: url }}
              style={styles.webView}
              injectedJavaScript={INJECTED_SUBMIT_DETECTOR}
              onMessage={handleMessage}
              onNavigationStateChange={handleNavigationStateChange}
              onError={() => setWebViewFailed(true)}
              renderError={() => (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    No se pudo cargar el formulario embebido.
                  </Text>
                  <Pressable style={styles.fallbackBtn} onPress={handleOpenExternal}>
                    <ExternalLink size={16} color="#FFFFFF" />
                    <Text style={styles.fallbackBtnText}>Abrir en Navegador Seguro</Text>
                  </Pressable>
                </View>
              )}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>Cargando formulario de Google...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.fallbackScreen}>
              <View style={styles.fallbackCard}>
                <View style={styles.fallbackIconCircle}>
                  <ClipboardList size={34} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.fallbackTitle}>Formulario Diario de Operación</Text>
                <Text style={styles.fallbackDescription}>
                  Abre el formulario oficial de Google en tu navegador seguro para registrar tus actividades del turno de hoy.
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.openBrowserBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
                  onPress={handleOpenExternal}
                >
                  <ExternalLink size={17} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.openBrowserBtnText}>ABRIR FORMULARIO</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Modal de Confirmación Estilo CaboSystems (usado al volver del navegador externo en fallback) */}
        <DailyFormConfirmModal
          visible={confirmModalVisible}
          type="confirm"
          title="¿Confirmar Envío?"
          message="¿Ya completaste y enviaste tus respuestas en el formulario diario de Google?"
          confirmText="SÍ, ENVIADO"
          cancelText="AÚN NO"
          onConfirm={handleConfirmSubmit}
          onCancel={() => setConfirmModalVisible(false)}
        />

        {/* Modal de Éxito Estilo CaboSystems al presionar "Enviar" en Google */}
        <DailyFormConfirmModal
          visible={successModalVisible}
          type="success"
          title="¡Formulario Registrado!"
          message="Tu reporte diario de campo ha sido registrado exitosamente para el turno de hoy en CaboSystems."
          confirmText="ENTENDIDO"
          onConfirm={handleSuccessClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c1117',
  },
  headerWrapper: {
    height: 64,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  badgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
  },
  fallbackBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  fallbackScreen: {
    flex: 1,
    backgroundColor: '#0c1117',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  fallbackCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161c22',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#343e48',
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  fallbackIconCircle: {
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
  fallbackTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  fallbackDescription: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: Spacing.xs,
  },
  openBrowserBtn: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  openBrowserBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
