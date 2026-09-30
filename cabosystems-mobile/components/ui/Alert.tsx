import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from 'lucide-react-native';
import { Colors, BorderRadius, Spacing } from '@/constants/Theme';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant: AlertVariant;
  title: string;
  message?: string;
  onClose?: () => void;
  actionText?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Alert: React.FC<AlertProps> = ({
  variant,
  title,
  message,
  onClose,
  actionText,
  onAction,
  style,
}) => {
  const config = {
    success: {
      bg: Colors.successLight, // #ECFDF3
      border: Colors.success, // #12B76A
      iconColor: Colors.success,
      Icon: CheckCircle2,
    },
    error: {
      bg: Colors.errorLight, // #FEF3F2
      border: Colors.error, // #F04438
      iconColor: Colors.error,
      Icon: XCircle,
    },
    warning: {
      bg: Colors.warningLight, // #FFFAEB
      border: Colors.warning, // #F79009
      iconColor: Colors.warning,
      Icon: AlertTriangle,
    },
    info: {
      bg: Colors.infoLight, // #F0F9FF
      border: Colors.info, // #0BA5EC
      iconColor: Colors.info,
      Icon: Info,
    },
  }[variant];

  const { Icon } = config;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={config.iconColor} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          {actionText && onAction && (
            <Pressable onPress={onAction} style={styles.actionPressable}>
              <Text style={[styles.actionText, { color: config.iconColor }]}>
                {actionText}
              </Text>
            </Pressable>
          )}
        </View>

        {onClose && (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.closeButton}
          >
            <X size={16} color={Colors.textDisabled} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md, // 12px
    borderWidth: 1,
    padding: Spacing.md,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconContainer: {
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  message: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionPressable: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  closeButton: {
    padding: 2,
    marginLeft: 4,
  },
});

export default Alert;
