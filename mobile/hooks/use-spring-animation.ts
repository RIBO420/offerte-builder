import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
 useReducedMotion } from 'react-native-reanimated';
import { springConfigs, type SpringConfig } from '../theme/animations';

export function usePressAnimation(config: SpringConfig = 'default') {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
    scale.value = withSpring(0.96, springConfigs[config]);
  }, [config, reduced]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
    scale.value = withSpring(1, springConfigs[config]);
  }, [config, reduced]);

  return { animatedStyle, onPressIn, onPressOut };
}

export function useScaleAnimation(config: SpringConfig = 'default') {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const enter = useCallback(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      scale.value = 1;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      opacity.value = 1;
      return;
    }
    scale.value = withSpring(1, springConfigs[config]);
    opacity.value = withTiming(1, { duration: 200 });
  }, [config, reduced]);

  const exit = useCallback(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      scale.value = 0;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      opacity.value = 0;
      return;
    }
    scale.value = withSpring(0.9, springConfigs[config]);
    opacity.value = withTiming(0, { duration: 150 });
  }, [config, reduced]);

  return { animatedStyle, enter, exit };
}
