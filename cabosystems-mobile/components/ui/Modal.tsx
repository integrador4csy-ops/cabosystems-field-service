import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, BorderRadius, Spacing, Shadow, Animation } from '@/constants/Theme';
import Button, { ButtonVariant } from './Button';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  confirmVariant?: ButtonVariant;
  confirmLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
  confirmText,
  cancelText,
  onConfirm,
  confirmVariant = 'primary',
  confirmLoading = false,
  style,
}) => {
  if (!visible) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        {/* Scrim Overlay */}
        <Pressable style={styles.scrim} onPress={onClose} />

        {/* Modal Card Content */}
        <View style={[styles.container, Shadow.lg, style]}>
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>

              {showCloseButton && (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && { opacity: Animation.pressOpacity },
                  ]}
                  hitSlop={8}
                >
                  <X size={18} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>
          )}

          {/* Body */}
          {children && <View style={styles.body}>{children}</View>}

          {/* Footer Actions */}
          {(confirmText || cancelText) && (
            <View style={styles.footer}>
              {cancelText && (
                <View style={styles.footerButtonWrapper}>
                  <Button
                    variant="outline"
                    size="md"
                    onPress={onClose}
                    disabled={confirmLoading}
                  >
                    {cancelText}
                  </Button>
                </View>
              )}
              {confirmText && onConfirm && (
                <View style={styles.footerButtonWrapper}>
                  <Button
                    variant={confirmVariant}
                    size="md"
                    onPress={onConfirm}
                    loading={confirmLoading}
                  >
                    {confirmText}
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 24, 40, 0.45)', // Scrim oscuro TailAdmin
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'], // 24px (rounded-3xl de TailAdmin)
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  footerButtonWrapper: {
    flex: 1,
  },
});

export default Modal;
