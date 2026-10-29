import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { agendaSwipeDirection } from '@/lib/agendaGestures';

function Neighbor({ index, position, offset, width, children }: { index: number; position: number; offset: SharedValue<number>; width: SharedValue<number>; children: React.ReactNode }) {
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value + position * width.value }] }));
  const id = index === -1 ? 'previous' : index === 1 ? 'next' : (index < 0 ? 'previous-' : 'next-') + Math.abs(index);
  return <Animated.View testID={'agenda-page-' + id} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.neighbor, pageStyle]}>{children}</Animated.View>;
}

export function AgendaSwipeArea({ children, previous, next, previousPages, nextPages, enabled, periodKey, scopeKey = periodKey, pagePosition = 0, canGoPrevious = true, canGoNext = true, onMove, style }: {
  children: React.ReactNode; enabled: boolean; periodKey: string; scopeKey?: string; pagePosition?: number;
  canGoPrevious?: boolean; canGoNext?: boolean; previous?: React.ReactNode; next?: React.ReactNode;
  previousPages?: React.ReactNode[]; nextPages?: React.ReactNode[];
  onMove: (direction: number, position?: number) => void; style?: StyleProp<ViewStyle>;
}) {
  const offset = useSharedValue(0), width = useSharedValue(0), dragging = useSharedValue(false);
  const origin = useSharedValue(0), target = useSharedValue(pagePosition);
  const generation = useSharedValue(0), gestureGeneration = useSharedValue(0);
  const minimum = useSharedValue(0), maximum = useSharedValue(0);
  const alive = useRef(true);
  const context = useRef({ enabled, scopeKey, generation: 0, onMove });
  const before = previousPages ?? [previous], after = nextPages ?? [next];
  const count = (pages: React.ReactNode[]) => { const missing = pages.findIndex(page => !page); return missing < 0 ? pages.length : missing; };
  const previousCount = canGoPrevious ? count(before) : 0;
  const nextCount = canGoNext ? count(after) : 0;

  const settle = useCallback((velocity = 0) => {
    'worklet';
    const destination = -target.value * width.value;
    const distance = Math.abs(destination - offset.value);
    if (distance < 1) { offset.value = destination; return; }
    const duration = Math.max(80, Math.min(200, distance / Math.max(Math.abs(velocity), width.value * 5, 1) * 1000));
    offset.value = withTiming(destination, { duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
  }, [offset, width, target]);

  useLayoutEffect(() => {
    const reset = context.current.scopeKey !== scopeKey || context.current.enabled !== enabled;
    const nextGeneration = context.current.generation + (reset ? 1 : 0);
    context.current = { enabled, scopeKey, generation: nextGeneration, onMove };
    scheduleOnUI(() => {
      'worklet';
      generation.value = nextGeneration;
      minimum.value = pagePosition - previousCount; maximum.value = pagePosition + nextCount;
      if (reset) {
        cancelAnimation(offset); dragging.value = false;
        target.value = pagePosition;
        offset.value = -pagePosition * width.value; origin.value = offset.value;
      }
      // Absolute page positions let React confirm a month without cancelling or
      // restarting the UI animation, including an already running second swipe.
    });
  }, [enabled, scopeKey, pagePosition, previousCount, nextCount, onMove, generation, minimum, maximum, offset, width, dragging, target, origin]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; cancelAnimation(offset); dragging.value = false; };
  }, [offset, dragging]);

  const requestMove = useCallback((direction: number, sourceGeneration: number, position: number) => {
    if (alive.current && context.current.enabled && context.current.generation === sourceGeneration) context.current.onMove(direction, position);
  }, []);

  const pan = useMemo(() => Gesture.Pan().enabled(enabled).activeOffsetX([-24, 24]).failOffsetY([-14, 14]).maxPointers(1)
    .onStart(() => {
      cancelAnimation(offset); dragging.value = true; origin.value = offset.value; gestureGeneration.value = generation.value;
    })
    .onUpdate(event => {
      if (!dragging.value || gestureGeneration.value !== generation.value) return;
      const desired = origin.value + event.translationX;
      const left = -maximum.value * width.value;
      const right = -minimum.value * width.value;
      offset.value = desired < left ? left + (desired - left) * .15 : desired > right ? right + (desired - right) * .15 : desired;
    })
    .onEnd(event => {
      if (!dragging.value || gestureGeneration.value !== generation.value) return;
      dragging.value = false;
      const direction = agendaSwipeDirection(event.translationX, event.translationY, event.velocityX);
      const nextTarget = target.value + direction;
      if (enabled && direction && width.value && nextTarget >= minimum.value && nextTarget <= maximum.value) {
        target.value = nextTarget;
        // Commit immediately; neither animation completion nor the title render gates another swipe.
        scheduleOnRN(requestMove, direction, gestureGeneration.value, nextTarget);
      }
      settle(event.velocityX);
    })
    .onFinalize((_event, success) => { if (!success) { dragging.value = false; settle(); } }),
  [enabled, offset, width, dragging, origin, target, generation, gestureGeneration, minimum, maximum, requestMove, settle]);
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value + pagePosition * width.value }] }));
  return <GestureDetector gesture={pan}><View collapsable={false} style={[style, s.viewport]} onLayout={event => {
    const nextWidth = event.nativeEvent.layout.width;
    scheduleOnUI(() => {
      'worklet';
      if (nextWidth === width.value) return;
      cancelAnimation(offset); dragging.value = false; width.value = nextWidth;
      offset.value = -target.value * nextWidth; origin.value = offset.value;
    });
  }}>
    {before.slice(0, previousCount).map((page, index) => <Neighbor key={`${scopeKey}:${pagePosition - index - 1}`} index={-index - 1} position={pagePosition - index - 1} offset={offset} width={width}>{page}</Neighbor>)}
    <Animated.View testID="agenda-page-current" style={[s.page, pageStyle]}>{children}</Animated.View>
    {after.slice(0, nextCount).map((page, index) => <Neighbor key={`${scopeKey}:${pagePosition + index + 1}`} index={index + 1} position={pagePosition + index + 1} offset={offset} width={width}>{page}</Neighbor>)}
  </View></GestureDetector>;
}
const s = StyleSheet.create({ viewport: { overflow: 'hidden' }, page: { flex: 1 }, neighbor: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } });
