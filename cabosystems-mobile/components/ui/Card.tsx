import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow, Animation } from '@/constants/Theme';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  elevated?: boolean;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  onPress,
  style,
  bodyStyle,
  titleStyle,
  subtitleStyle,
  elevated = true,
  noPadding = false,
}) => {
  const hasHeader = Boolean(title || subtitle || headerAction);

  const cardContent = (
    <View
      style={[
        styles.card,
        elevated ? Shadow.sm : null,
        style,
      ]}
    >
      {hasHeader && (
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            {title && (
              <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, subtitleStyle]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
          {headerAction && <View style={styles.headerAction}>{headerAction}</View>}
        </View>
      )}

      <View
        style={[
          styles.body,
          hasHeader && styles.bodyWithHeader,
          noPadding && styles.noPadding,
          bodyStyle,
        ]}
      >
        {children}
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
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, // 16px
    borderWidth: 1,
    borderColor: Colors.border, // #E4E7EC
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerAction: {
    alignItems: 'flex-end',
  },
  body: {
    padding: Spacing.md,
  },
  bodyWithHeader: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.xs,
  },
  noPadding: {
    padding: 0,
    paddingTop: 0,
  },
});

export default Card;
