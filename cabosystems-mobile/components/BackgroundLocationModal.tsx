import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { MapPin, Settings2, ShieldCheck, ChevronRight } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, Spacing } from '@/constants/Theme';

export const BG_LOC_DISMISSED_KEY = 'cabosystems_bg_loc_prompt_dismissed_at';
const COOLDOWN_HOURS_MS = 24 * 60 * 60 * 1000; // 24 horas

interface BackgroundLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export default function BackgroundLocationModal({
  visible,
  onClose,
  onOpenSettings,
}: BackgroundLocationModalProps) {
  const handleConfigureNow = async () => {
    try {
      await SecureStore.setItemAsync(BG_LOC_DISMISSED_KEY, Date.now().toString());
    } catch {}
    onClose();
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      Linking.openSettings();
    }
  };

  const handleDismissLater = async () => {
    try {
      await SecureStore.setItemAsync(BG_LOC_DISMISSED_KEY, Date.now().toString());
    } catch {}
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismissLater}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <MapPin size={30} color={Colors.primary} strokeWidth={2.2} />
          </View>

          {/* Title & Description */}
          <Text style={styles.modalTitle}>Ubicación en Segundo Plano</Text>
          <Text style={styles.modalSubtitle}>
            Para que el radar de <Text style={styles.boldText}>CaboSystems</Text> sincronice tu asistencia técnica en tiempo real cuando tu teléfono esté bloqueado o la app minimizada:
          </Text>

          {/* Step by Step Guide */}
          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Toca en <Text style={styles.stepHighlight}>"Configurar ahora"</Text>
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Entra a <Text style={styles.stepHighlight}>Permisos</Text> ➔ <Text style={styles.stepHighlight}>Ubicación</Text>
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Selecciona <Text style={styles.stepHighlight}>"Permitir todo el tiempo"</Text>
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleConfigureNow}
            >
              <Settings2 size={18} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>CONFIGURAR AHORA</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleDismissLater}
            >
              <Text style={styles.secondaryBtnText}>MÁS TARDE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Verifica si se debe mostrar el modal respetando el tiempo de espera (cooldown)
 */
export async function shouldShowBackgroundLocationPrompt(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const dismissedStr = await SecureStore.getItemAsync(BG_LOC_DISMISSED_KEY);
    if (dismissedStr) {
      const dismissedAt = parseInt(dismissedStr, 10);
      if (!isNaN(dismissedAt) && Date.now() - dismissedAt < COOLDOWN_HOURS_MS) {
        return false;
      }
    }
  } catch {}
  return true;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 140, 38, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#343e48',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: 'rgba(52, 62, 72, 0.85)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  boldText: {
    fontFamily: 'Outfit_700Bold',
    color: '#343e48',
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f78c26',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 12.5,
    color: '#343e48',
    lineHeight: 17,
  },
  stepHighlight: {
    fontFamily: 'Outfit_700Bold',
    color: '#0f172a',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  primaryBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    width: '100%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: 'rgba(52, 62, 72, 0.65)',
    letterSpacing: 0.5,
  },
});
