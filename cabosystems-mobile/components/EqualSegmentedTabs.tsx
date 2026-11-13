import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AgendaPalette as P } from '@/constants/Theme';

type TabIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

export type EqualSegmentedTab<T extends string> = {
  id: T;
  label: string;
  icon?: TabIcon;
};

export function EqualSegmentedTabs<T extends string>({
  accessibilityLabel,
  value,
  tabs,
  onChange,
}: {
  accessibilityLabel: string;
  value: T;
  tabs: readonly EqualSegmentedTab<T>[];
  onChange: (value: T) => void;
}) {
  return <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.container}>
    {tabs.map(({ id, label, icon: Icon }) => {
      const active = value === id;
      return <Pressable
        key={id}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => onChange(id)}
        style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
      >
        {Icon ? <Icon size={17} color={active ? P.white : P.slate} strokeWidth={2.2} /> : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: P.wash,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeTab: { backgroundColor: P.accent },
  label: { flexShrink: 1, color: P.slate, fontFamily: 'Outfit_600SemiBold', fontSize: 13, textAlign: 'center' },
  activeLabel: { color: P.white, fontFamily: 'Outfit_700Bold' },
  pressed: { opacity: 0.72 },
});
