import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

const createShadow = (ios: Omit<ShadowStyle, 'elevation'>, androidElevation: number): ShadowStyle =>
  Platform.select({
    ios: { ...ios },
    android: { elevation: androidElevation },
    default: { ...ios },
  }) as ShadowStyle;

export const shadows = {
  none: createShadow({
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  }, 0),
  sm: createShadow({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  }, 1),
  card: createShadow({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  }, 3),
  md: createShadow({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  }, 4),
  lg: createShadow({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  }, 8),
  modal: createShadow({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 60,
  }, 24),
};
