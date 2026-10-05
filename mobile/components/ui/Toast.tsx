import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useIsDonker, useVeldKleuren } from '../veld/BuitenModus';

type Icoon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50;

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';
export type ToastPosition = 'top' | 'bottom';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastProps extends ToastData {
  position: ToastPosition;
  onDismiss: (id: string) => void;
  index: number;
}

// Toon per variant: icoon en kleurpaar uit het actieve thema.
function variantToon(k: ColorScheme, variant: ToastVariant): { Icoon: Icoon; voor: string; achter: string } {
  switch (variant) {
    case 'success':
      return { Icoon: CircleCheck, voor: k.success, achter: k.successSoft };
    case 'error':
      return { Icoon: CircleX, voor: k.danger, achter: k.dangerSoft };
    case 'warning':
      return { Icoon: TriangleAlert, voor: k.warning, achter: k.warningSoft };
    default:
      return { Icoon: Info, voor: k.info, achter: k.infoSoft };
  }
}

export function Toast({
  id,
  title,
  description,
  variant = 'default',
  duration = 3000,
  position,
  onDismiss,
  index,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  // Minder beweging: toast verschijnt en verdwijnt alleen door te vervagen.
  const rustig = useReducedMotion();
  // useMemo i.p.v. useRef(...).current: zelfde stabiele Animated.Value-instanties,
  // maar zonder ref-toegang tijdens render (react-hooks/refs).
  // position bepaalt alleen de startpositie; bewust eenmalig, zoals useRef deed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const translateY = useMemo(() => new Animated.Value(position === 'top' ? -100 : 100), []);
  const translateX = useMemo(() => new Animated.Value(0), []);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const scale = useMemo(() => new Animated.Value(0.9), []);

  const { Icoon, voor, achter } = variantToon(kleuren, variant);

  // Calculate stack offset
  const stackOffset = index * 12;
  const stackScale = 1 - index * 0.03;

  const dismiss = () => {
    if (rustig) {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss(id));
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(id));
  };

  useEffect(() => {
    // Animate in
    if (rustig) {
      translateY.setValue(0);
      scale.setValue(stackScale);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: stackScale,
          useNativeDriver: true,
          speed: 14,
          bounciness: 4,
        }),
      ]).start();
    }

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
    // Bewust alleen duration/stackScale: 'dismiss' is per render een nieuwe functie;
    // opnemen zou de auto-dismiss-timer bij elke render resetten (gedragswijziging).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, stackScale]);

  // useMemo i.p.v. useRef(...).current: stabiele PanResponder zonder ref-toegang
  // tijdens render. Bewust zonder deps: de handlers sluiten (net als voorheen)
  // over de mount-waarden; opnieuw aanmaken zou lopende gestures breken.
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        // Allow vertical swipe dismiss
        if (
          (position === 'top' && gestureState.dy < 0) ||
          (position === 'bottom' && gestureState.dy > 0)
        ) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismissHorizontal = Math.abs(gestureState.dx) > SWIPE_THRESHOLD;
        const shouldDismissVertical =
          (position === 'top' && gestureState.dy < -SWIPE_THRESHOLD) ||
          (position === 'bottom' && gestureState.dy > SWIPE_THRESHOLD);

        if (shouldDismissHorizontal && rustig) {
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss(id));
        } else if (shouldDismissHorizontal) {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss(id));
        } else if (shouldDismissVertical) {
          dismiss();
        } else if (rustig) {
          translateX.setValue(0);
          translateY.setValue(0);
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 10,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 10,
            }),
          ]).start();
        }
      },
    }),
    // Zie boven: bewust mount-closures, zoals de oorspronkelijke useRef-variant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const containerStyle: ViewStyle = {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000 - index,
    ...(position === 'top'
      ? { top: insets.top + 12 + stackOffset }
      : { bottom: insets.bottom + 12 + stackOffset }),
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          transform: [
            { translateY },
            { translateX },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: kleuren.card,
          borderWidth: 1,
          borderColor: kleuren.border,
          borderRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: donker ? 0.4 : 0.1,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: achter, alignItems: 'center', justifyContent: 'center' }}>
          <Icoon size={20} color={voor} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground, fontSize: 16 }]} numberOfLines={2}>
            {title}
          </Text>
          {description && (
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]} numberOfLines={3}>
              {description}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default Toast;
