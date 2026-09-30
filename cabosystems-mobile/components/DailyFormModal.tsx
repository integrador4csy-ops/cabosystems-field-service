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
import * as WebBrowser from 'expo-web-browser';
import {
  X,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { Button, Badge } from '@/components/ui';
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
        toolbarColor: '#1A202C',
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
        {/* Encabezado Minimalista en Modo Claro */}
        <View style={styles.headerWrapper}>
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
                  <RotateCw size={16} color={Colors.textSecondary} strokeWidth={2.2} />
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                onPress={onClose}
                hitSlop={8}
              >
                <X size={18} color={Colors.textSecondary} strokeWidth={2.5} />
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
                  <Button
                    variant="primary"
                    size="md"
                    startIcon={<ExternalLink size={16} color="#FFFFFF" />}
                    onPress={handleOpenExternal}
                  >
                    Abrir en Navegador Seguro
                  </Button>
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
                  <ClipboardList size={32} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <Badge color="primary" variant="light" size="sm" style={{ marginBottom: 10 }}>
                  TURNO DE HOY
                </Badge>
                <Text style={styles.fallbackTitle}>Formulario Diario de Operación</Text>
                <Text style={styles.fallbackDescription}>
                  Abre el formulario oficial de Google en tu navegador seguro para registrar tus actividades del turno de hoy.
                </Text>

                <Button
                  variant="primary"
                  size="lg"
                  startIcon={<ExternalLink size={17} color="#FFFFFF" strokeWidth={2.2} />}
                  onPress={handleOpenExternal}
                >
                  ABRIR FORMULARIO
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* Modal de Confirmación Estilo TailAdmin */}
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

        {/* Modal de Éxito Estilo TailAdmin */}
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
    backgroundColor: '#FFFFFF',
  },
  headerWrapper: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: 'center',
    ...Shadow.xs,
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
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
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
    fontFamily: 'Outfit_500Medium',
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
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  fallbackScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  fallbackCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Shadow.lg,
  },
  fallbackIconCircle: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  fallbackTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  fallbackDescription: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: Spacing.xs,
  },
});
