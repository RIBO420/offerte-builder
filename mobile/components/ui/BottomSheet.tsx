import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;
// Zoals een iOS-blad: snel omhoog en zacht uitlopen, zonder na te veren.
const OPEN = { duration: 320, easing: Easing.out(Easing.cubic) };
const DICHT = { duration: 220, easing: Easing.in(Easing.cubic) };

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Na afloop van de sluitanimatie: hier mag de ouder de inhoud pas opruimen. */
  onGesloten?: () => void;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  onGesloten,
}: BottomSheetProps) {
  const kleuren = useVeldKleuren();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  // Blijft gemonteerd tot de sluitanimatie klaar is, anders verdwijnt het blad in één klap.
  const [zichtbaar, setZichtbaar] = useState(isOpen);
  if (isOpen && !zichtbaar) setZichtbaar(true);
  const naSluiten = useRef(onGesloten);
  useEffect(() => { naSluiten.current = onGesloten; }, [onGesloten]);
  // Alleen melden na een echte open→dicht-overgang, niet bij een dicht gemount blad.
  const geopend = useRef(false);
  const gesloten = useCallback(() => {
    setZichtbaar(false);
    if (geopend.current) { geopend.current = false; naSluiten.current?.(); }
  }, []);

  useEffect(() => {
    if (isOpen) {
      geopend.current = true;
      translateY.set(withTiming(0, OPEN));
      backdropOpacity.set(withTiming(1, { duration: 240 }));
    } else {
      backdropOpacity.set(withTiming(0, DICHT));
      translateY.set(withTiming(SCREEN_HEIGHT, DICHT, klaar => { if (klaar) scheduleOnRN(gesloten); }));
    }
    // Shared values zijn stabiele referenties; opnemen in deps is gedragsneutraal.
  }, [isOpen, translateY, backdropOpacity, gesloten]);

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
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 800) {
        translateY.set(withTiming(SCREEN_HEIGHT, DICHT));
        backdropOpacity.set(withTiming(0, DICHT, () => {
          scheduleOnRN(handleClose);
        }));
      } else {
        translateY.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  if (!zichtbaar) return null;

  // Als Modal over het hele scherm, waar het blad ook in de boom staat (bv. in een
  // lijst binnen een ScrollView). Een Modal is een eigen root, dus hij krijgt een
  // eigen GestureHandlerRootView. Vegen om te sluiten zit op de greep; de inhoud
  // scrolt zelf en schuift mee met het toetsenbord.
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { backgroundColor: kleuren.scrim }, backdropStyle]} accessibilityRole="none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Sluit paneel" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: kleuren.card, borderColor: kleuren.border }, sheetStyle]}
            accessibilityViewIsModal
            accessibilityLabel={title ?? 'Paneel'}
          >
            <GestureDetector gesture={panGesture}>
              <View>
                <View style={styles.handleContainer}>
                  <View style={[styles.handle, { backgroundColor: kleuren.inactive }]} />
                </View>
                {title && <Text accessibilityRole="header" style={[tekst.kop, styles.title, { color: kleuren.foreground }]}>{title}</Text>}
              </View>
            </GestureDetector>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
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
    paddingBottom: 8,
  },
});
