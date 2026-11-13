import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Theme';

const INK = '#343e48';

/** Diámetro de la burbuja naranja: envuelve al icono (28 dp) con aire. */
const CAPSULE_SIZE = 36;

/** Reserva lateral de la barra (paddingHorizontal del tab bar) para centrar la burbuja en la ranura. */
const BAR_PADDING = 6;

type Motion = {
  position: SharedValue<number>;
  tabs: readonly string[];
  visible: boolean;
  /** Centro vertical del icono, en coordenadas de pantalla. */
  iconCenterY: SharedValue<number>;
  /** Borde superior de la barra, en coordenadas de pantalla. */
  barTop: SharedValue<number>;
};

const Context = createContext<Motion | null>(null);

export function tabCoverage(position: number, index: number) {
  'worklet';
  return Math.max(0, Math.min(1, (0.48 - Math.abs(position - index)) / 0.23));
}

export function ConnectedTabBarProvider({ activeTab, tabs, children }: { activeTab: string; tabs: readonly string[]; children: React.ReactNode }) {
  const index = tabs.indexOf(activeTab);
  const position = useSharedValue(Math.max(0, index));
  const iconCenterY = useSharedValue(0);
  const barTop = useSharedValue(0);
  useEffect(() => {
    if (index < 0) return;
    // Un muelle deja que la burbuja se deslice de forma continua y se detenga sin
    // tirón; con temporizador el salto final se nota y parece un parpadeo.
    position.value = withSpring(index, { damping: 24, stiffness: 190, mass: 0.9, reduceMotion: ReduceMotion.System });
  }, [index, position]);
  const value = useMemo(() => ({ position, tabs, visible: index >= 0, iconCenterY, barTop }), [position, tabs, index, iconCenterY, barTop]);
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
  const { position, tabs, visible, iconCenterY, barTop } = useMotion();
  const ref = useRef<ViewInstance>(null);
  const slot = Math.max(0, width - 12) / tabs.length;
  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * slot }],
    // Centrada en el icono: se mide su posición real en pantalla en lugar de
    // suponerla, para que no dependa del alto de la barra ni de las métricas.
    top: (iconCenterY.value > 0 ? iconCenterY.value - barTop.value : 23) - CAPSULE_SIZE / 2,
  }));
  const measure = useCallback(() => {
    ref.current?.measureInWindow?.((_x, y) => { barTop.value = y; });
  }, [barTop]);
  return <View ref={ref} pointerEvents="none" style={s.background} onLayout={event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
    measure();
  }}>
    {visible && <Animated.View testID="connected-tab-capsule" style={[s.capsule, { left: BAR_PADDING + slot / 2 - CAPSULE_SIZE / 2, width: CAPSULE_SIZE, height: CAPSULE_SIZE, borderRadius: CAPSULE_SIZE / 2 }, motionStyle]} />}
  </View>;
}

export function ConnectedTabIcon({ tab, Icon, size = 23 }: { tab: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; size?: number }) {
  const { position, tabs, visible, iconCenterY } = useMotion();
  const index = tabs.indexOf(tab);
  const ref = useRef<ViewInstance>(null);
  const darkStyle = useAnimatedStyle(() => ({ opacity: visible ? 1 - tabCoverage(position.value, index) : 1 }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: visible ? tabCoverage(position.value, index) : 0 }));
  const measure = useCallback(() => {
    ref.current?.measureInWindow?.((_x, y, _w, h) => { iconCenterY.value = y + h / 2; });
  }, [iconCenterY]);
  return <View ref={ref} style={s.icon} onLayout={measure}>
    <Animated.View style={darkStyle}><Icon size={size} color={INK} strokeWidth={2.1} /></Animated.View>
    <Animated.View testID={`tab-icon-light-${tab}`} pointerEvents="none" style={[StyleSheet.absoluteFill, s.icon, lightStyle]}><Icon size={size} color="#FFFFFF" strokeWidth={2.1} /></Animated.View>
  </View>;
}

export function ConnectedTabLabel({ tab, children }: { tab: string; children: React.ReactNode }) {
  // La palabra se mantiene siempre en tinta: antes se volvía blanca sobre la
  // burbuja y las letras que sobresalían quedaban ilegibles.
  return <Text testID={`tab-label-${tab}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.label}>{children}</Text>;
}

export function ConnectedTabButton(props: React.ComponentProps<typeof Pressable>) {
  return <Pressable {...props} android_ripple={{ color: 'transparent', borderless: false }} style={[typeof props.style === 'function' ? undefined : props.style, s.button]} />;
}

const s = StyleSheet.create({
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 36, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  capsule: { position: 'absolute', backgroundColor: Colors.primary },
  button: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, color: INK, fontFamily: 'Outfit_600SemiBold', fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
