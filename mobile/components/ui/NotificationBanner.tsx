import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { hapticPatterns } from '../../theme/haptics';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

interface NotificationBannerProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  time: string;
  isUnread?: boolean;
  onPress: () => void;
  onDismiss: () => void;
}

/**
 * Melding als tikbare regel; naar rechts vegen verbergt hem. Een flick telt
 * ook (snelheid óf afstand), en losgelaten veert hij met de vingersnelheid terug.
 */
export function NotificationBanner({ icon, title, subtitle, time, isUnread = false, onPress, onDismiss }: NotificationBannerProps) {
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  const [ingedrukt, setIngedrukt] = useState(false);
  const translateX = useSharedValue(0);

  const verberg = useCallback(() => {
    void hapticPatterns.tap();
    onDismiss();
  }, [onDismiss]);

  const pan = Gesture.Pan()
    .activeOffsetX(16)
    .failOffsetY([-12, 12])
    .onUpdate(e => {
      // Naar links: rubberband, naar rechts: volgt de vinger.
      translateX.set(e.translationX > 0 ? e.translationX : e.translationX * 0.2);
    })
    .onEnd(e => {
      if (e.translationX > 110 || e.velocityX > 800) {
        translateX.set(withTiming(420, { duration: 180 }, klaar => {
          if (klaar) scheduleOnRN(verberg);
        }));
      } else {
        translateX.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: e.velocityX }));
      }
    });

  const stijl = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: 1 - Math.min(Math.max(translateX.get(), 0) / 360, 0.8),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={stijl}>
        <Pressable
          onPress={() => { void hapticPatterns.tap(); onPress(); }}
          onPressIn={() => setIngedrukt(true)}
          onPressOut={() => setIngedrukt(false)}
          accessibilityRole="button"
          accessibilityLabel={`${isUnread ? 'Nieuw: ' : ''}${title}. ${subtitle}`}
          accessibilityHint="Veeg naar rechts om te verbergen"
          accessibilityActions={[{ name: 'dismiss', label: 'Verbergen' }]}
          onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'dismiss') onDismiss(); }}
        >
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: kleuren.card,
              borderWidth: 1,
              borderColor: kleuren.border,
              borderRadius: 18,
              paddingVertical: 12,
              paddingHorizontal: 14,
              transform: [{ scale: ingedrukt && !rustig ? 0.98 : 1 }],
              transitionProperty: 'transform',
              transitionDuration: 120,
              transitionTimingFunction: 'ease-out',
            }}
          >
            {icon}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[tekst.kop, { color: kleuren.foreground, fontSize: 16 }]} numberOfLines={1}>{title}</Text>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]} numberOfLines={2}>{subtitle}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6, alignSelf: 'flex-start', paddingTop: 2 }}>
              <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>{time}</Text>
              {isUnread && <View accessibilityElementsHidden style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: kleuren.primary }} />}
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
