import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';

interface NotificationBannerProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  time: string;
  isUnread?: boolean;
  onPress: () => void;
  onDismiss: () => void;
}

export function NotificationBanner({
  icon,
  title,
  subtitle,
  time,
  isUnread = false,
  onPress,
  onDismiss,
}: NotificationBannerProps) {
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(20)
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
        opacity.value = 1 - event.translationX / 300;
      }
    })
    .onEnd((event) => {
      if (event.translationX > 120) {
        translateX.value = withTiming(400, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    hapticPatterns.tap();
    onPress();
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[pressStyle, swipeStyle]}>
        <Pressable
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.container}
        >
          {isUnread && <View style={styles.unreadDot} />}
          <View style={styles.iconArea}>{icon}</View>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text style={styles.time}>{time}</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  unreadDot: {
    position: 'absolute',
    left: 6,
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginTop: -3,
  },
  iconArea: {
    marginLeft: 4,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  subtitle: {
    fontSize: 9,
    color: '#888',
  },
  time: {
    fontSize: 8,
    color: '#555',
    textAlign: 'right',
  },
});
