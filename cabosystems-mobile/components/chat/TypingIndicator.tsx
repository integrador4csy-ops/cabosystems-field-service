import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { ChatPalette as P } from '@/constants/Theme';

interface TypingIndicatorProps {
  names: string[];
  language: string;
}

export function TypingIndicator({ names, language }: TypingIndicatorProps) {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const label = useMemo(() => {
    if (names.length === 1) return language === 'en' ? `${names[0]} is typing` : `${names[0]} está escribiendo`;
    if (names.length === 2) return language === 'en' ? `${names[0]} and ${names[1]} are typing` : `${names[0]} y ${names[1]} están escribiendo`;
    if (names.length > 2) return language === 'en' ? `${names.length} people are typing` : `${names.length} personas están escribiendo`;
    return '';
  }, [language, names]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!label || reduceMotion) {
      dots.forEach(dot => dot.setValue(0.65));
      return;
    }
    const animations = dots.map((dot, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 120),
      Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0.35, duration: 260, useNativeDriver: true }),
      Animated.delay((2 - index) * 120),
    ])));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [dots, label, reduceMotion]);

  return <View style={styles.slot} accessibilityLiveRegion="polite">
    {label ? <View style={styles.content}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {dots.map((dot, index) => <Animated.View key={index} style={[styles.dot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0.35, 1], outputRange: [0, -2] }) }] }]} />)}
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  slot: { minHeight: 26, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: P.white },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: P.slate, opacity: 0.72 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent },
});
