import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Colors, Typography, BorderRadius, Spacing, Shadow } from '@/constants/Theme';
import { AppVersionInfo } from '@/lib/appUpdateService';

interface AppUpdateModalProps {
  visible: boolean;
  updateInfo: AppVersionInfo | null;
  onClose: () => void;
}

export function resolveDirectApkUrl(url: string, version: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.toLowerCase().endsWith('.apk')) return trimmed;

  const tagMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/i);
  if (tagMatch) {
    const [, owner, repo, tag] = tagMatch;
    return `https://github.com/${owner}/${repo}/releases/download/${tag}/cabosystems-field-service.apk`;
  }

  const repoMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/releases/i);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    const tag = version.startsWith('v') ? version : `v${version}`;
    return `https://github.com/${owner}/${repo}/releases/download/${tag}/cabosystems-field-service.apk`;
  }

  return trimmed;
}

type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

export default function AppUpdateModal({
  visible,
  updateInfo,
  onClose,
}: AppUpdateModalProps) {
  const { t: tr } = useInterfaceTranslation();
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState({ written: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadedFileUri, setDownloadedFileUri] = useState<string | null>(null);
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);

  useEffect(() => {
    let active = true;
    if (!updateInfo?.latest_version) return;
    const targetFile = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}CaboSystems-v${updateInfo.latest_version}.apk`;
    FileSystem.getInfoAsync(targetFile)
      .then((info) => {
        if (active && info.exists && info.size && info.size > 1024 * 1024) {
          setDownloadStatus('completed');
          setDownloadProgress(1);
          setDownloadedFileUri(targetFile);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (downloadRef.current) {
        try {
          void downloadRef.current.cancelAsync();
        } catch {}
      }
    };
  }, [updateInfo?.latest_version]);

  const installApk = useCallback(async (apkLocalUri: string, fallbackUrl: string) => {
    if (Platform.OS !== 'android') {
      await Linking.openURL(fallbackUrl);
      return;
    }

    try {
      const contentUri = await FileSystem.getContentUriAsync(apkLocalUri);

      try {
        if (IntentLauncher && typeof IntentLauncher.startActivityAsync === 'function') {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: 'application/vnd.android.package-archive',
          });
          return;
        }
      } catch (err) {
        console.warn('IntentLauncher failed, trying openURL:', err);
      }

      await Linking.openURL(contentUri);
    } catch (e) {
      console.warn('Could not launch APK installer:', e);
      await Linking.openURL(fallbackUrl);
    }
  }, []);

  if (!updateInfo || !visible) return null;

  const handleDownload = async () => {
    const rawUrl = updateInfo.apk_url;
    if (!rawUrl) return;

    const directUrl = resolveDirectApkUrl(rawUrl, updateInfo.latest_version);

    if (downloadStatus === 'completed' && downloadedFileUri) {
      await installApk(downloadedFileUri, directUrl);
      return;
    }

    setDownloadStatus('downloading');
    setDownloadProgress(0);
    setErrorMessage(null);
    setDownloadBytes({ written: 0, total: 0 });

    try {
      const targetFile = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}CaboSystems-v${updateInfo.latest_version}.apk`;

      const downloadResumable = FileSystem.createDownloadResumable(
        directUrl,
        targetFile,
        {},
        (progressData) => {
          if (progressData.totalBytesExpectedToWrite > 0) {
            const p = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
            setDownloadProgress(Math.min(1, Math.max(0, p)));
            setDownloadBytes({
              written: progressData.totalBytesWritten,
              total: progressData.totalBytesExpectedToWrite,
            });
          } else {
            setDownloadBytes({
              written: progressData.totalBytesWritten,
              total: 0,
            });
          }
        }
      );

      downloadRef.current = downloadResumable;
      const result = await downloadResumable.downloadAsync();

      if (!result?.uri) {
        throw new Error(tr("Error al descargar la actualización."));
      }

      setDownloadStatus('completed');
      setDownloadProgress(1);
      setDownloadedFileUri(result.uri);

      await installApk(result.uri, directUrl);
    } catch (err: any) {
      console.warn('Error downloading update:', err);
      setDownloadStatus('error');
      setErrorMessage(err?.message || tr("Error al descargar la actualización."));
    } finally {
      downloadRef.current = null;
    }
  };

  const directUrl = resolveDirectApkUrl(updateInfo.apk_url, updateInfo.latest_version);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!updateInfo.is_forced && downloadStatus !== 'downloading') {
          onClose();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download-outline" size={32} color={Colors.primary} />
            </View>
          </View>

          {/* Badge & Title */}
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{tr("NUEVA VERSIÓN v")}{updateInfo.latest_version}</Text>
          </View>

          <Text style={styles.title}>{tr("¡Actualización Disponible!")}</Text>
          <Text style={styles.subtitle}>{tr("Tienes instalada la versión ")}<Text style={styles.boldText}>v{updateInfo.current_version}</Text>.{' '}
            {updateInfo.is_forced
              ? tr(" Esta actualización es obligatoria para continuar operando en campo.")
              : tr(" Te recomendamos actualizar para disfrutar de las últimas mejoras y correcciones.")}
          </Text>

          {/* Release Notes Box */}
          {!!updateInfo.release_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>{tr("Novedades:")}</Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={styles.notesText}>{updateInfo.release_notes}</Text>
              </ScrollView>
            </View>
          )}

          {/* Barra de Progreso de Descarga */}
          {(downloadStatus === 'downloading' || downloadStatus === 'completed' || downloadStatus === 'error') && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {downloadStatus === 'completed'
                    ? tr("Descarga completada")
                    : downloadStatus === 'error'
                    ? tr("Error al descargar la actualización.")
                    : tr("Descargando actualización...")}
                </Text>
                <Text
                  style={[
                    styles.progressPercent,
                    downloadStatus === 'completed' && styles.progressPercentCompleted,
                    downloadStatus === 'error' && styles.progressPercentError,
                  ]}
                >
                  {downloadStatus === 'completed'
                    ? '100%'
                    : downloadStatus === 'error'
                    ? ''
                    : `${Math.round(downloadProgress * 100)}%`}
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(downloadProgress * 100)}%` },
                    downloadStatus === 'completed' && styles.progressBarFillCompleted,
                    downloadStatus === 'error' && styles.progressBarFillError,
                  ]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.progressBytes}>
                  {downloadBytes.total > 0
                    ? `${(downloadBytes.written / (1024 * 1024)).toFixed(1)} MB ${tr("de")} ${(downloadBytes.total / (1024 * 1024)).toFixed(1)} MB`
                    : downloadBytes.written > 0
                    ? `${(downloadBytes.written / (1024 * 1024)).toFixed(1)} MB`
                    : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                downloadStatus === 'downloading' && styles.primaryButtonDisabled,
              ]}
              onPress={handleDownload}
              activeOpacity={0.85}
              disabled={downloadStatus === 'downloading'}
            >
              {downloadStatus === 'downloading' && (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.primaryButtonText}>
                {downloadStatus === 'downloading'
                  ? `${tr("Descargando...")} (${Math.round(downloadProgress * 100)}%)`
                  : downloadStatus === 'completed'
                  ? tr("Instalar actualización")
                  : downloadStatus === 'error'
                  ? tr("Reintentar descarga")
                  : tr("Descargar e Instalar")}
              </Text>
            </TouchableOpacity>

            {downloadStatus === 'error' && (
              <TouchableOpacity
                style={styles.browserFallbackButton}
                onPress={() => Linking.openURL(directUrl)}
                activeOpacity={0.7}
              >
                <Text style={styles.browserFallbackText}>{tr("Descargar desde el navegador")}</Text>
              </TouchableOpacity>
            )}

            {!updateInfo.is_forced && downloadStatus !== 'downloading' && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>{tr("Recordar más tarde")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    ...Shadow.lg,
  },
  iconContainer: {
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: 'rgba(247, 140, 38, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  boldText: {
    fontFamily: 'Outfit_700Bold',
    color: Colors.text,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.08)',
    marginBottom: Spacing.md,
    maxHeight: 120,
  },
  notesTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
  },
  notesScroll: {
    maxHeight: 80,
  },
  notesText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: 'rgba(52, 62, 72, 0.75)',
    lineHeight: 16,
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  progressPercent: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  progressPercentCompleted: {
    color: '#10B981',
  },
  progressPercentError: {
    color: '#EF4444',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E4E7EC',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressBarFillCompleted: {
    backgroundColor: '#10B981',
  },
  progressBarFillError: {
    backgroundColor: '#EF4444',
  },
  progressFooter: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  progressBytes: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    ...Shadow.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  browserFallbackButton: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browserFallbackText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: 'rgba(52, 62, 72, 0.65)',
  },
});
