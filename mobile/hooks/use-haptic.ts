import { useCallback } from 'react';
import { hapticPatterns, type HapticPattern } from '../theme/haptics';

export function useHaptic(pattern: HapticPattern = 'tap') {
  return useCallback(() => {
    hapticPatterns[pattern]();
  }, [pattern]);
}
