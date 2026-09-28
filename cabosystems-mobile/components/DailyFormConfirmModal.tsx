import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/Theme';

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
  cancelText = 'CANCELAR',
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

  const defaultConfirmText = isSuccess ? 'ENTENDIDO' : 'CONFIRMAR';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Círculo de Ícono Tecnológico CaboSystems */}
          <View style={styles.modalIconCircle}>
            {isSuccess ? (
              <CheckCircle2 size={30} color={Colors.primary} strokeWidth={2.5} />
            ) : (
              <ClipboardCheck size={30} color={Colors.primary} strokeWidth={2.5} />
            )}
          </View>

          {/* Título y Mensaje */}
          <Text style={styles.modalTitle}>{title || defaultTitle}</Text>
          <Text style={styles.modalMessage}>{message || defaultMessage}</Text>

          {/* Botones */}
          {isSuccess ? (
            <Pressable
              style={({ pressed }) => [
                styles.modalFullBtn,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.modalFullBtnText}>{confirmText || defaultConfirmText}</Text>
            </Pressable>
          ) : (
            <View style={styles.modalButtonRow}>
              {onCancel && (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={onCancel}
                >
                  <Text style={styles.modalCancelBtnText}>{cancelText}</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={onConfirm}
              >
                <Text style={styles.modalConfirmBtnText}>{confirmText || defaultConfirmText}</Text>
              </Pressable>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161c22',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#343e48',
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  modalIconCircle: {
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
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modalMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: Spacing.xs,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343e48',
    backgroundColor: 'rgba(52, 62, 72, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: '#cbd5e1',
    letterSpacing: 0.8,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  modalFullBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modalFullBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
