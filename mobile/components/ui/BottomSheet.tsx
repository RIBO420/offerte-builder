import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { springConfigs } from '../../theme/animations';

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
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateY.value = withSpring(0, springConfigs.default);
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, springConfigs.default);
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        translateY.value = withSpring(SCREEN_HEIGHT, springConfigs.default);
        backdropOpacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(0, springConfigs.default);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, backdropStyle]} accessibilityRole="none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Sluit paneel" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, sheetStyle]} accessibilityRole="summary" accessibilityLabel={title ?? 'Paneel'}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    backgroundColor: '#333',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8E8E8',
    textAlign: 'center',
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 16,
  },
});
