import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';

interface ProjectListItemProps {
  name: string;
  scope: string;
  progress: number;
  icon: React.ReactNode;
  onPress: () => void;
}

export const ProjectListItem = React.memo(function ProjectListItem({
  name,
  scope,
  progress,
  icon,
  onPress,
}: ProjectListItemProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const progressColor = clampedProgress > 50 ? '#4ADE80' : '#888';

  const handlePress = () => {
    hapticPatterns.tap();
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.container}
      >
        <View style={styles.row}>
          <View style={styles.iconContainer}>{icon}</View>
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.scope} numberOfLines={1}>
              {scope}
            </Text>
          </View>
          <Text style={[styles.progressText, { color: progressColor }]}>
            {clampedProgress}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${clampedProgress}%` },
            ]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    padding: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.4)',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  scope: {
    fontSize: 9,
    color: '#666',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#0A0A0A',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 1.5,
  },
});
