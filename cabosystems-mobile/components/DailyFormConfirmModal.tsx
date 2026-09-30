import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { Button } from '@/components/ui/Button';

interface DailyFormConfirmModalProps {
  visible: boolean;
  type?: 'confirm' | 'success';
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function DailyFormConfirmModal({
  visible,
  type = 'confirm',
  title,
  message,
  confirmText,
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: DailyFormConfirmModalProps) {
  const isSuccess = type === 'success';

  const defaultTitle = isSuccess
    ? '¡Formulario Registrado!'
    : '¿Completaste el Formulario?';

  const defaultMessage = isSuccess
    ? 'Tu reporte diario de campo ha sido completado y registrado exitosamente en CaboSystems.'
    : 'Si ya enviaste tus respuestas en Google Forms, confirma para registrar tu turno de campo.';

  const defaultConfirmText = isSuccess ? 'Entendido' : 'Confirmar';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        {/* Scrim click */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel || onConfirm}
        />

        <View style={[styles.modalCard, Shadow.lg]}>
          {/* Círculo de Ícono TailAdmin */}
          <View
            style={[
              styles.modalIconCircle,
              isSuccess ? styles.iconCircleSuccess : styles.iconCirclePrimary,
            ]}
          >
            {isSuccess ? (
              <CheckCircle2 size={28} color={Colors.success} strokeWidth={2.2} />
            ) : (
              <ClipboardCheck size={28} color={Colors.primary} strokeWidth={2.2} />
            )}
          </View>

          {/* Título y Mensaje */}
          <Text style={styles.modalTitle}>{title || defaultTitle}</Text>
          <Text style={styles.modalMessage}>{message || defaultMessage}</Text>

          {/* Botones estilo TailAdmin */}
          {isSuccess ? (
            <View style={styles.buttonFullWrapper}>
              <Button
                variant="primary"
                size="md"
                onPress={onConfirm}
              >
                {confirmText || defaultConfirmText}
              </Button>
            </View>
          ) : (
            <View style={styles.modalButtonRow}>
              {onCancel && (
                <View style={styles.buttonCol}>
                  <Button
                    variant="outline"
                    size="md"
                    onPress={onCancel}
                  >
                    {cancelText}
                  </Button>
                </View>
              )}

              <View style={styles.buttonCol}>
                <Button
                  variant="primary"
                  size="md"
                  onPress={onConfirm}
                >
                  {confirmText || defaultConfirmText}
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)', // Scrim oscuro TailAdmin
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'], // 24px (rounded-3xl de TailAdmin)
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    zIndex: 10,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCirclePrimary: {
    backgroundColor: Colors.primaryLight, // #fff7ed
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  iconCircleSuccess: {
    backgroundColor: Colors.successLight, // #ecfdf3
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonFullWrapper: {
    width: '100%',
  },
  modalButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  buttonCol: {
    flex: 1,
  },
});
