import React, { Component, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ExternalLink, Video as VideoIcon, AlertCircle } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';

export interface ChatVideoPlayerModalProps {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
  onError?: (err?: any) => void;
}

/**
 * Componente interno que inicializa el reproductor oficial expo-video
 */
function InternalExpoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      nativeControls
      allowsPictureInPicture
      contentFit="contain"
    />
  );
}

/**
 * Error boundary para capturar cualquier eventualidad de entorno nativo
 */
class VideoErrorBoundary extends Component<
  { fallback: (retry: () => void) => React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[ChatVideoPlayerModal] Error in native video playback:', error);
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.retry);
    }
    return this.props.children;
  }
}

export const ChatVideoPlayerModal = React.memo(function ChatVideoPlayerModal({
  visible,
  url,
  title,
  onClose,
  onError,
}: ChatVideoPlayerModalProps) {
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const c = CHAT_COPY[language];
  const [loading, setLoading] = useState(true);

  // Cierre con botón atrás en Android
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

  // Reset del estado de carga al cambiar URL
  useEffect(() => {
    if (visible && url) {
      setLoading(false);
    }
  }, [visible, url]);

  if (!visible || !url) return null;

  const handleOpenExternal = () => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        onError?.(err);
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Encabezado con controles superiores y área segura */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.closeVideo}
            onPress={onClose}
            style={({ pressed }) => [styles.headerButton, pressed && styles.buttonPressed]}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          <View style={styles.titleContainer}>
            <Text numberOfLines={1} style={styles.title}>
              {title || c.video}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.openExternal}
            onPress={handleOpenExternal}
            style={({ pressed }) => [styles.headerButton, pressed && styles.buttonPressed]}
          >
            <ExternalLink size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Área del reproductor */}
        <View style={styles.videoArea}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>{c.videoLoading}</Text>
            </View>
          ) : Platform.OS === 'web' ? (
            // Soporte web nativo HTML5 video
            <View style={StyleSheet.absoluteFill}>
              {/* @ts-ignore */}
              <video
                src={url}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#000000',
                }}
              />
            </View>
          ) : (
            <VideoErrorBoundary
              fallback={(retry) => (
                <View style={styles.errorContainer}>
                  <AlertCircle size={44} color={Colors.primary} />
                  <Text style={styles.errorTitle}>{c.videoError}</Text>
                  <View style={styles.errorButtons}>
                    <Pressable
                      style={styles.retryButton}
                      onPress={retry}
                      accessibilityRole="button"
                      accessibilityLabel={c.retry}
                    >
                      <Text style={styles.retryButtonText}>{c.retry}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.externalButton}
                      onPress={handleOpenExternal}
                      accessibilityRole="button"
                      accessibilityLabel={c.openExternal}
                    >
                      <Text style={styles.externalButtonText}>{c.openExternal}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            >
              <InternalExpoPlayer key={url} url={url} />
            </VideoErrorBoundary>
          )}
        </View>

        {/* Espaciador inferior para barra de navegación */}
        <View style={{ height: Math.max(insets.bottom, 12) }} />
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  videoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  errorTitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  externalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  externalButtonText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
