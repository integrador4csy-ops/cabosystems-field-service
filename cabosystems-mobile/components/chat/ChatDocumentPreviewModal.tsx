import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  BackHandler,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  ExternalLink,
  Download,
  Share2,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { ChatPalette as P, Colors } from '@/constants/Theme';
import { getDocumentInfo } from '@/lib/chatDocumentTypes';
import { ChatDocumentBadge } from './ChatDocumentBadge';
import { useTranslation } from '@/lib/i18n';
import { CHAT_COPY } from '@/lib/chatCopy';

export interface ChatDocumentPreviewModalProps {
  visible: boolean;
  url: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  onClose: () => void;
  onError?: () => void;
}

export const ChatDocumentPreviewModal = memo(function ChatDocumentPreviewModal({
  visible,
  url,
  fileName,
  fileSize,
  mimeType,
  onClose,
  onError,
}: ChatDocumentPreviewModalProps) {
  const { t: tr } = useInterfaceTranslation();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const c = CHAT_COPY[language];
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const docInfo = getDocumentInfo(fileName, mimeType, url);

  useEffect(() => {
    if (visible) {
      setWebViewLoading(true);
      setHasError(false);
    }
  }, [visible, url]);

  // Manejo del botón atrás nativo en Android
  useEffect(() => {
    if (!visible) return;
    const back = Platform.OS === 'android'
      ? BackHandler.addEventListener('hardwareBackPress', () => {
          onClose();
          return true;
        })
      : null;
    return () => {
      back?.remove();
    };
  }, [visible, onClose]);

  if (!visible || !url) return null;

  const handleOpenExternal = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Error opening document externally:', err);
      onError?.();
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        url,
        message: fileName || tr(docInfo.typeName),
        title: fileName || tr(docInfo.typeName),
      });
    } catch {
      // Ignorar cancelación
    }
  };

  const formattedSize = fileSize
    ? fileSize > 1024 * 1024
      ? (fileSize / (1024 * 1024)).toFixed(1) + ' MB'
      : (fileSize / 1024).toFixed(0) + ' KB'
    : '';

  // Determinar la URL para previsualizar:
  // Para PDF, Word, Excel, PPT utilizamos Google Docs Viewer (soporta HTTPS públicos)
  const isOfficeOrPdf = ['pdf', 'word', 'excel', 'powerpoint'].includes(docInfo.category);
  const isImage = docInfo.category === 'image';
  const isRemoteHttp = url.startsWith('http://') || url.startsWith('https://');

  const viewerUrl =
    isOfficeOrPdf && isRemoteHttp
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      : url;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.close}
            onPress={onClose}
            hitSlop={10}
            style={styles.closeButton}
          >
            <X size={22} color={P.ink} />
          </Pressable>

          <View style={styles.headerDocInfo}>
            <ChatDocumentBadge info={docInfo} size={34} />
            <View style={styles.headerTitles}>
              <Text style={styles.headerFileName} numberOfLines={1}>
                {fileName || tr(docInfo.typeName)}
              </Text>
              <Text style={styles.headerMeta}>
                {tr(docInfo.typeName)}
                {formattedSize ? ` · ${formattedSize}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.openExternal}
              onPress={handleOpenExternal}
              hitSlop={8}
              style={styles.actionButton}
            >
              <ExternalLink size={20} color={P.slate} />
            </Pressable>
          </View>
        </View>

        {/* Preview Content */}
        <View style={styles.content}>
          {isImage ? (
            <Image
              source={{ uri: url }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : isOfficeOrPdf && isRemoteHttp && !hasError ? (
            <View style={StyleSheet.absoluteFill}>
              <WebView
                source={{ uri: viewerUrl }}
                style={styles.webView}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>
                      {language === 'es'
                        ? 'Generando vista previa del documento...'
                        : 'Loading document preview...'}
                    </Text>
                  </View>
                )}
                onError={() => setHasError(true)}
                onHttpError={() => setHasError(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                javaScriptEnabled
                domStorageEnabled
                scalesPageToFit
              />
            </View>
          ) : (
            <View style={styles.fallbackContainer}>
              <ChatDocumentBadge info={docInfo} size={72} />
              <Text style={styles.fallbackTitle}>
                {fileName || tr(docInfo.typeName)}
              </Text>
              <Text style={styles.fallbackSubtitle}>
                {formattedSize
                  ? `${tr(docInfo.typeName)} · ${formattedSize}`
                  : tr(docInfo.typeName)}
              </Text>
              <Text style={styles.fallbackHint}>
                {hasError
                  ? language === 'es'
                    ? tr("La vista previa web no pudo cargarse directamente. Puedes abrirlo con tu app de lectura favorita.")
                    : 'Web preview could not load directly. You can open it with your favorite app.'
                  : language === 'es'
                  ? tr("Abre este archivo con el visor predeterminado de tu teléfono.")
                  : 'Open this file with your phone default viewer.'}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.openExternal}
                onPress={handleOpenExternal}
                style={styles.openExternalBtn}
              >
                <ExternalLink size={18} color="#FFFFFF" />
                <Text style={styles.openExternalBtnText}>
                  {language === 'es'
                    ? tr("Abrir con aplicación externa")
                    : 'Open with external app'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Bottom Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.openExternal}
            onPress={handleOpenExternal}
            style={styles.bottomBarButton}
          >
            <Download size={18} color={P.ink} />
            <Text style={styles.bottomBarButtonText}>
              {language === 'es' ? 'Descargar / Abrir' : 'Download / Open'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr("Compartir")}
            onPress={handleShare}
            style={styles.bottomBarButton}
          >
            <Share2 size={18} color={P.ink} />
            <Text style={styles.bottomBarButtonText}>
              {language === 'es' ? tr("Compartir") : 'Share'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.wash,
  },
  headerDocInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitles: {
    flex: 1,
  },
  headerFileName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: P.ink,
  },
  headerMeta: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: P.slate,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: P.slate,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  fallbackTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: P.ink,
    textAlign: 'center',
    marginTop: 8,
  },
  fallbackSubtitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: P.slate,
    textAlign: 'center',
  },
  fallbackHint: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: P.slate,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  openExternalBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: P.line,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  bottomBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: P.wash,
  },
  bottomBarButtonText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: P.ink,
  },
});
