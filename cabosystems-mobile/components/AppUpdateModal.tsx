import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing, Shadow } from '@/constants/Theme';
import { AppVersionInfo } from '@/lib/appUpdateService';

interface AppUpdateModalProps {
  visible: boolean;
  updateInfo: AppVersionInfo | null;
  onClose: () => void;
}

export default function AppUpdateModal({
  visible,
  updateInfo,
  onClose,
}: AppUpdateModalProps) {
  if (!updateInfo || !visible) return null;

  const handleDownload = async () => {
    if (!updateInfo.apk_url) return;
    try {
      const supported = await Linking.canOpenURL(updateInfo.apk_url);
      if (supported) {
        await Linking.openURL(updateInfo.apk_url);
      } else {
        await Linking.openURL(updateInfo.apk_url);
      }
    } catch (e) {
      console.warn('Error al abrir enlace de actualización:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!updateInfo.is_forced) {
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
            <Text style={styles.badgeText}>
              NUEVA VERSIÓN v{updateInfo.latest_version}
            </Text>
          </View>

          <Text style={styles.title}>¡Actualización Disponible!</Text>
          <Text style={styles.subtitle}>
            Tienes instalada la versión <Text style={styles.boldText}>v{updateInfo.current_version}</Text>. 
            {updateInfo.is_forced
              ? ' Esta actualización es obligatoria para continuar operando en campo.'
              : ' Te recomendamos actualizar para disfrutar de las últimas mejoras y correcciones.'}
          </Text>

          {/* Release Notes Box */}
          {!!updateInfo.release_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>Novedades:</Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={styles.notesText}>{updateInfo.release_notes}</Text>
              </ScrollView>
            </View>
          )}

          {/* Actions */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Ionicons name="download" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Descargar e Instalar</Text>
            </TouchableOpacity>

            {!updateInfo.is_forced && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Recordar más tarde</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
  primaryButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
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
