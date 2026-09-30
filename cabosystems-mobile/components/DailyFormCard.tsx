import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ClipboardCheck, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow, Animation } from '@/constants/Theme';
import { Badge } from '@/components/ui/Badge';
import { formatCompletedTime } from '@/lib/dailyForm';

interface DailyFormCardProps {
  completed: boolean;
  completedAt?: string | null;
  onPress: () => void;
  loading?: boolean;
}

export default function DailyFormCard({
  completed,
  completedAt,
  onPress,
  loading = false,
}: DailyFormCardProps) {
  const timeFormatted = formatCompletedTime(completedAt);

  if (completed) {
    return (
      <View style={[styles.card, styles.cardCompleted, Shadow.xs]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconBox, styles.iconBoxCompleted]}>
            <CheckCircle2 size={22} color={Colors.success} strokeWidth={2.2} />
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.titleCompleted}>Reporte Diario de Campo</Text>
            <Text style={styles.subtitleCompleted}>
              Registrado hoy {timeFormatted ? `· ${timeFormatted}` : ''}
            </Text>
          </View>

          <Badge color="success" variant="light" size="sm">
            Completado
          </Badge>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        styles.cardPending,
        Shadow.sm,
        pressed && {
          transform: [{ scale: Animation.pressScale }],
          opacity: Animation.pressOpacity,
        },
      ]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.contentRow}>
        <View style={[styles.iconBox, styles.iconBoxPending]}>
          <ClipboardCheck size={22} color={Colors.primary} strokeWidth={2.2} />
        </View>

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.titlePending}>Formulario Diario de Campo</Text>
            <View style={styles.pulseDot} />
          </View>
          <Text style={styles.subtitlePending}>
            Pendiente de registrar para el turno de hoy
          </Text>
        </View>

        <View style={styles.chevronContainer}>
          <ChevronRight size={22} color={Colors.primary} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg, // 16px TailAdmin
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: Spacing.md,
    backgroundColor: Colors.card,
  },
  cardPending: {
    borderWidth: 1.5,
    borderColor: Colors.borderBrand, // #FED7AA
  },
  cardCompleted: {
    borderWidth: 1,
    borderColor: Colors.border, // #E4E7EC
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md, // 12px
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxPending: {
    backgroundColor: Colors.primaryLight, // #fff7ed
  },
  iconBoxCompleted: {
    backgroundColor: Colors.successLight, // #ecfdf3
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  titlePending: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text,
  },
  titleCompleted: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  subtitlePending: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.primaryDark,
  },
  subtitleCompleted: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
