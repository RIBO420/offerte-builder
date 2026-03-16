import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
import { springConfigs, type SpringConfig } from '../theme/animations';

export function usePressAnimation(config: SpringConfig = 'default') {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(0.96, springConfigs[config]);
  }, [config, reduced]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
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
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSpring(1, springConfigs[config]);
    opacity.value = withTiming(1, { duration: 200 });
  }, [config, reduced]);

  const exit = useCallback(() => {
    if (reduced) {
      scale.value = 0;
      opacity.value = 0;
      return;
    }
    scale.value = withSpring(0.9, springConfigs[config]);
    opacity.value = withTiming(0, { duration: 150 });
  }, [config, reduced]);

  return { animatedStyle, enter, exit };
}
