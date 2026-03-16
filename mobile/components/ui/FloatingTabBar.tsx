import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Camera,
  Clock,
  MessageCircle,
  User,
} from 'lucide-react-native';
import { hapticPatterns } from '../../theme/haptics';
import { springConfigs } from '../../theme/animations';

const ACTIVE_COLOR = '#4ADE80';
const INACTIVE_COLOR = '#555555';
const ICON_SIZE = 22;

const routeIcons: Record<string, React.ComponentType<any>> = {
  index: Home,
  fotos: Camera,
  uren: Clock,
  chat: MessageCircle,
  profiel: User,
};

const routeLabels: Record<string, string> = {
  index: 'Home',
  fotos: "Foto's",
  uren: 'Uren',
  chat: 'Chat',
  profiel: 'Profiel',
};

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const IconComponent = routeIcons[route.name] ?? Home;
  const label = routeLabels[route.name] ?? route.name;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.85, springConfigs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfigs.snappy);
  };

  const handlePress = () => {
    hapticPatterns.selection();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <IconComponent
          size={ICON_SIZE}
          color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
          strokeWidth={isFocused ? 2.2 : 1.8}
        />
        {isFocused && (
          <Text style={styles.label}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.container}>
        <BlurView intensity={40} tint="dark" style={styles.blur}>
          <View style={styles.overlay}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <TabItem
                  key={route.key}
                  route={route}
                  isFocused={isFocused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  blur: {
    overflow: 'hidden',
  },
  overlay: {
    flexDirection: 'row',
    backgroundColor: 'rgba(17,17,17,0.85)',
    paddingVertical: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  label: {
    fontSize: 9,
    color: ACTIVE_COLOR,
    marginTop: 2,
    fontWeight: '600',
  },
});
