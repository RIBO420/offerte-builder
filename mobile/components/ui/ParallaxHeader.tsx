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
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

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
  const kleuren = useVeldKleuren();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.get(),
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
      scrollY.get(),
      [0, height * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.get(),
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
          colors={[kleuren.gradientStart, kleuren.background]}
          style={[styles.header, { height }]}
        >
          <Animated.View style={titleStyle}>
            <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: 4 }]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
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
  childrenContainer: {
    flex: 1,
  },
});
