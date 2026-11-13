import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Theme';

const INK = '#343e48';

/** Reserva lateral de la barra (paddingHorizontal del tab bar). */
const BAR_PADDING = 6;

type Motion = {
  position: SharedValue<number>;
  tabs: readonly string[];
  visible: boolean;
};

const Context = createContext<Motion | null>(null);

export function tabCoverage(position: number, index: number) {
  'worklet';
  if (!Number.isFinite(position)) return 0;
  return Math.max(0, Math.min(1, (0.5 - Math.abs(position - index)) / 0.25));
}

export function ConnectedTabBarProvider({
  activeTab,
  tabs,
  children,
}: {
  activeTab: string;
  tabs: readonly string[];
  children: React.ReactNode;
}) {
  const index = tabs.indexOf(activeTab);
  const position = useSharedValue(Math.max(0, index));

  useLayoutEffect(() => {
    if (index < 0) return;
    if (typeof cancelAnimation === 'function') {
      cancelAnimation(position);
    }
    // Transición estándar Material 3 (~150ms): movimiento directo, sobredumping sin rebotes
    // y velocidad limpia para responder al instante a toques rápidos.
    position.value = withSpring(index, {
      damping: 26,
      stiffness: 300,
      mass: 0.3,
      velocity: 0,
      overshootClamping: true,
      restDisplacementThreshold: 0.005,
      restSpeedThreshold: 0.005,
      reduceMotion: ReduceMotion.System,
    });
  }, [index, position]);

  const value = useMemo(
    () => ({ position, tabs, visible: index >= 0 }),
    [position, tabs, index]
  );
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

  // Ancho útil disponible para las ranuras de pestañas
  const slot = tabs.length > 0 ? Math.max(0, width - BAR_PADDING * 2) / tabs.length : 0;
  // La cápsula envuelve todo el slot (icono y texto) con un margen horizontal sutil
  const capsuleWidth = Math.max(0, slot - 4);

  const motionStyle = useAnimatedStyle(() => {
    const raw = Number.isFinite(position.value) ? position.value : 0;
    const clamped = Math.max(0, Math.min(tabs.length - 1, raw));
    return {
      transform: [{ translateX: clamped * slot }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={s.background}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
      }}
    >
      {visible && (
        <Animated.View
          testID="connected-tab-capsule"
          style={[
            s.capsule,
            {
              left: BAR_PADDING + 2,
              width: capsuleWidth,
            },
            motionStyle,
          ]}
        />
      )}
    </View>
  );
}

export function ConnectedTabIcon({
  tab,
  Icon,
  size = 22,
}: {
  tab: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  size?: number;
}) {
  const { position, tabs, visible } = useMotion();
  const index = tabs.indexOf(tab);

  const darkStyle = useAnimatedStyle(() => ({
    opacity: visible ? 1 - tabCoverage(position.value, index) : 1,
  }));
  const lightStyle = useAnimatedStyle(() => ({
    opacity: visible ? tabCoverage(position.value, index) : 0,
  }));

  return (
    <View style={s.icon}>
      <Animated.View style={darkStyle}>
        <Icon size={size} color={INK} strokeWidth={2.1} />
      </Animated.View>
      <Animated.View
        testID={`tab-icon-light-${tab}`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.icon, lightStyle]}
      >
        <Icon size={size} color="#FFFFFF" strokeWidth={2.1} />
      </Animated.View>
    </View>
  );
}

export function ConnectedTabLabel({
  tab,
  children,
}: {
  tab: string;
  children: React.ReactNode;
}) {
  const { position, tabs, visible } = useMotion();
  const index = tabs.indexOf(tab);

  const motionStyle = useAnimatedStyle(() => {
    const coverage = visible ? tabCoverage(position.value, index) : 0;
    const safeCoverage = Number.isFinite(coverage) ? Math.max(0, Math.min(1, coverage)) : 0;
    return {
      color: interpolateColor(
        safeCoverage,
        [0, 1],
        [INK, '#FFFFFF']
      ),
    };
  });

  return (
    <Animated.Text
      testID={`tab-label-${tab}`}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={[s.label, motionStyle]}
    >
      {children}
    </Animated.Text>
  );
}

export function ConnectedTabButton(props: React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      delayPressIn={0}
      android_ripple={{
        color: 'rgba(247, 140, 38, 0.20)',
        borderless: false,
      }}
      {...props}
      style={[
        typeof props.style === 'function' ? undefined : props.style,
        s.button,
      ]}
    />
  );
}

const s = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  capsule: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  button: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  icon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 0,
  },
  pressed: {
    opacity: 0.72,
  },
});
