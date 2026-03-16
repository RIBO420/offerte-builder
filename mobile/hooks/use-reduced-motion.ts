import { useReducedMotion } from 'react-native-reanimated';

export { useReducedMotion };

/**
 * Returns animation duration — 0 if user prefers reduced motion.
 */
export function useAnimationDuration(ms: number): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : ms;
}
