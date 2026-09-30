import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow, Animation } from '@/constants/Theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  badge?: React.ReactNode;
  subtitle?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBg = Colors.backgroundDark,
  badge,
  subtitle,
  onPress,
  style,
}) => {
  const content = (
    <View style={[styles.container, Shadow.xs, style]}>
      {/* Top row: Icon + optional badge */}
      <View style={styles.topRow}>
        <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        {badge && <View style={styles.badgeWrapper}>{badge}</View>}
      </View>

      {/* Bottom section: Label and Value */}
      <View style={styles.infoWrapper}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && {
            transform: [{ scale: Animation.pressScale }],
            opacity: Animation.pressOpacity,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, // 16px
    borderWidth: 1,
    borderColor: Colors.border, // #E4E7EC
    padding: Spacing.md,
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md, // 12px
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrapper: {
    alignItems: 'flex-end',
  },
  infoWrapper: {
    marginTop: 2,
  },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textDisabled,
    marginTop: 2,
  },
});

export default StatCard;
