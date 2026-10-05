import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { springConfigs } from '../../theme/animations';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const kleuren = useVeldKleuren();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateY.set(withSpring(0, springConfigs.default));
      backdropOpacity.set(withTiming(1, { duration: 300 }));
    } else {
      translateY.set(withSpring(SCREEN_HEIGHT, springConfigs.default));
      backdropOpacity.set(withTiming(0, { duration: 200 }));
    }
    // Shared values zijn stabiele referenties; opnemen in deps is gedragsneutraal.
  }, [isOpen, translateY, backdropOpacity]);

  const handleClose = () => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.set(event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        translateY.set(withSpring(SCREEN_HEIGHT, springConfigs.default));
        backdropOpacity.set(withTiming(0, { duration: 200 }, () => {
          scheduleOnRN(handleClose);
        }));
      } else {
        translateY.set(withSpring(0, springConfigs.default));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  if (!isOpen) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { backgroundColor: kleuren.scrim }, backdropStyle]} accessibilityRole="none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Sluit paneel" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.sheet, { backgroundColor: kleuren.card, borderColor: kleuren.border }, sheetStyle]}
          accessibilityRole="summary"
          accessibilityLabel={title ?? 'Paneel'}
        >
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: kleuren.inactive }]} />
          </View>
          {title && <Text style={[tekst.kop, styles.title, { color: kleuren.foreground }]}>{title}</Text>}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    minHeight: 200,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 16,
  },
});
