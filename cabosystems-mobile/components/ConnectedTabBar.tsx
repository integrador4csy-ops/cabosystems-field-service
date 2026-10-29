import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type PressableProps } from 'react-native';
import Animated, { Easing, ReduceMotion, interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Theme';

const INK = '#343e48';
const Context = createContext<{ position: SharedValue<number>; tabs: readonly string[]; visible: boolean } | null>(null);

export function tabCoverage(position: number, index: number) {
  'worklet';
  return Math.max(0, Math.min(1, (0.48 - Math.abs(position - index)) / 0.23));
}

export function ConnectedTabBarProvider({ activeTab, tabs, children }: { activeTab: string; tabs: readonly string[]; children: React.ReactNode }) {
  const index = tabs.indexOf(activeTab);
  const position = useSharedValue(Math.max(0, index));
  useEffect(() => {
    if (index < 0) return;
    // Shared by the capsule, labels and icons: no separate focus/color timers.
    position.value = withTiming(index, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
  }, [index, position]);
  const value = useMemo(() => ({ position, tabs, visible: index >= 0 }), [position, tabs, index >= 0]);
  return <Context value={value}>{children}</Context>;
}

function useMotion() {
  const motion = useContext(Context);
  if (!motion) throw new Error('Connected tab bar requires its provider');
  return motion;
}

export function ConnectedTabBackground() {
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(0, windowWidth - 32));
  const { position, tabs, visible } = useMotion();
  const slot = Math.max(0, width - 12) / tabs.length;
  const motionStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * slot }] }));
  return <View pointerEvents="none" style={s.background} onLayout={event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
  }}>
    {visible && <Animated.View testID="connected-tab-capsule" style={[s.capsule, { width: Math.max(0, slot - 4) }, motionStyle]} />}
  </View>;
}

export function ConnectedTabIcon({ tab, Icon, size = 21 }: { tab: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; size?: number }) {
  const { position, tabs, visible } = useMotion();
  const index = tabs.indexOf(tab);
  const darkStyle = useAnimatedStyle(() => ({ opacity: visible ? 1 - tabCoverage(position.value, index) : 1 }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: visible ? tabCoverage(position.value, index) : 0 }));
  return <View style={s.icon}>
    <Animated.View style={darkStyle}><Icon size={size} color={INK} strokeWidth={2.1} /></Animated.View>
    <Animated.View testID={`tab-icon-light-${tab}`} pointerEvents="none" style={[StyleSheet.absoluteFill, s.icon, lightStyle]}><Icon size={size} color="#FFFFFF" strokeWidth={2.1} /></Animated.View>
  </View>;
}

export function ConnectedTabLabel({ tab, children }: { tab: string; children: React.ReactNode }) {
  const { position, tabs, visible } = useMotion();
  const index = tabs.indexOf(tab);
  const motionStyle = useAnimatedStyle(() => ({ color: interpolateColor(visible ? tabCoverage(position.value, index) : 0, [0, 1], [INK, '#FFFFFF']) }));
  return <Animated.Text testID={`tab-label-${tab}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[s.label, motionStyle]}>{children}</Animated.Text>;
}

export function ConnectedTabButton(props: PressableProps) {
  return <Pressable {...props} android_ripple={{ color: 'transparent', borderless: false }} style={[typeof props.style === 'function' ? undefined : props.style, s.button]} />;
}

const s = StyleSheet.create({
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 36, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  capsule: { position: 'absolute', left: 8, top: 6, bottom: 6, borderRadius: 30, backgroundColor: Colors.primary },
  button: { flex: 1, borderRadius: 30, padding: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, lineHeight: 16, includeFontPadding: false, textAlign: 'center', alignSelf: 'stretch', marginTop: 2 },
});
