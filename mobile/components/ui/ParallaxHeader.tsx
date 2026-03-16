import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

interface ParallaxHeaderProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: React.ReactNode;
}

export function ParallaxHeader({
  title,
  subtitle,
  height = 200,
  children,
}: ParallaxHeaderProps) {
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, height],
      [1, 0.9],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale }],
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, height * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, height],
      [0, -30],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <Animated.View style={[{ height }, headerStyle]}>
        <LinearGradient
          colors={['#1A2E1A', '#0A0A0A']}
          style={[styles.header, { height }]}
        >
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      <View style={styles.childrenContainer}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E8E8E8',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B8F6B',
    marginTop: 4,
  },
  childrenContainer: {
    flex: 1,
  },
});
