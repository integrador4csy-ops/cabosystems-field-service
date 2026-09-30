import React from 'react';
import {
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow, Animation } from '@/constants/Theme';

export type ButtonVariant = 'primary' | 'outline' | 'soft' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const isDisabled = disabled || loading;

  const getVariantStyles = (): {
    container: ViewStyle;
    text: TextStyle;
    spinnerColor: string;
  } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? '#FDBA74' : Colors.primary,
            borderColor: isDisabled ? '#FDBA74' : Colors.primary,
            borderWidth: 1,
            ...(isDisabled ? {} : Shadow.xs),
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'outline':
        return {
          container: {
            backgroundColor: Colors.card,
            borderColor: Colors.borderHover, // #D0D5DD
            borderWidth: 1,
            ...(isDisabled ? {} : Shadow.xs),
          },
          text: { color: isDisabled ? Colors.textDisabled : Colors.text },
          spinnerColor: Colors.text,
        };
      case 'soft':
        return {
          container: {
            backgroundColor: Colors.primaryLight, // #fff7ed
            borderColor: Colors.borderBrand,
            borderWidth: 1,
          },
          text: { color: isDisabled ? Colors.textDisabled : Colors.primaryDark },
          spinnerColor: Colors.primaryDark,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? '#FCA5A5' : Colors.error,
            borderColor: isDisabled ? '#FCA5A5' : Colors.error,
            borderWidth: 1,
            ...(isDisabled ? {} : Shadow.xs),
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 1,
          },
          text: { color: isDisabled ? Colors.textDisabled : Colors.textSecondary },
          spinnerColor: Colors.textSecondary,
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { height: 36, paddingHorizontal: Spacing.sm },
          text: { fontSize: 13, lineHeight: 18 },
        };
      case 'md':
        return {
          container: { height: 44, paddingHorizontal: Spacing.md },
          text: { fontSize: 14, lineHeight: 20 },
        };
      case 'lg':
        return {
          container: { height: 50, paddingHorizontal: Spacing.lg },
          text: { fontSize: 15, lineHeight: 22 },
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        vStyles.container,
        sStyles.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && {
          transform: [{ scale: Animation.pressScale }],
          opacity: Animation.pressOpacity,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.spinnerColor} />
      ) : (
        <View style={styles.contentRow}>
          {startIcon && <View style={styles.iconStart}>{startIcon}</View>}
          <Text
            style={[
              styles.textBase,
              sStyles.text,
              vStyles.text,
              textStyle,
            ]}
            numberOfLines={1}
          >
            {children}
          </Text>
          {endIcon && <View style={styles.iconEnd}>{endIcon}</View>}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.sm, // 8px estándar TailAdmin
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  textBase: {
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  iconStart: {
    marginRight: 2,
  },
  iconEnd: {
    marginLeft: 2,
  },
});

export default Button;
