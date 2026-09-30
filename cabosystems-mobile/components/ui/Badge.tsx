import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Colors, BorderRadius, Typography } from '@/constants/Theme';

export type BadgeVariant = 'light' | 'solid';
export type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'gray';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'light',
  color = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  style,
  textStyle,
}) => {
  const isSolid = variant === 'solid';

  // Configuración de colores semánticos TailAdmin adaptados a CaboSystems
  const colorPalette = {
    primary: {
      bg: isSolid ? Colors.primary : Colors.primaryLight,
      border: isSolid ? Colors.primary : Colors.borderBrand,
      text: isSolid ? '#FFFFFF' : Colors.primaryDark,
    },
    success: {
      bg: isSolid ? Colors.success : Colors.successLight,
      border: isSolid ? Colors.success : Colors.successBorder,
      text: isSolid ? '#FFFFFF' : Colors.successText,
    },
    warning: {
      bg: isSolid ? Colors.warning : Colors.warningLight,
      border: isSolid ? Colors.warning : Colors.warningBorder,
      text: isSolid ? '#FFFFFF' : Colors.warningText,
    },
    error: {
      bg: isSolid ? Colors.error : Colors.errorLight,
      border: isSolid ? Colors.error : Colors.errorBorder,
      text: isSolid ? '#FFFFFF' : Colors.errorText,
    },
    info: {
      bg: isSolid ? Colors.info : Colors.infoLight,
      border: isSolid ? Colors.info : Colors.infoBorder,
      text: isSolid ? '#FFFFFF' : Colors.infoText,
    },
    gray: {
      bg: isSolid ? Colors.textSecondary : Colors.backgroundDark,
      border: isSolid ? Colors.textSecondary : Colors.border,
      text: isSolid ? '#FFFFFF' : Colors.textSecondary,
    },
  }[color];

  const sizeStyle = size === 'sm' ? styles.sizeSm : styles.sizeMd;
  const textSizeStyle = size === 'sm' ? styles.textSm : styles.textMd;

  return (
    <View
      style={[
        styles.base,
        sizeStyle,
        {
          backgroundColor: colorPalette.bg,
          borderColor: colorPalette.border,
        },
        style,
      ]}
    >
      {startIcon && <View style={styles.startIcon}>{startIcon}</View>}
      <Text
        style={[
          styles.textBase,
          textSizeStyle,
          { color: colorPalette.text },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {endIcon && <View style={styles.endIcon}>{endIcon}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sizeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  sizeMd: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    gap: 5,
  },
  textBase: {
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
  startIcon: {
    marginRight: 1,
  },
  endIcon: {
    marginLeft: 1,
  },
});

export default Badge;
