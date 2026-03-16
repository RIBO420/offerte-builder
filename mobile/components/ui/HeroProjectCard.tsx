import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { Camera, Clock } from 'lucide-react-native';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';

interface HeroProjectCardProps {
  projectName: string;
  description: string;
  progress: number;
  onPress: () => void;
  onPhotoPress: () => void;
  onHoursPress: () => void;
}

export function HeroProjectCard({
  projectName,
  description,
  progress,
  onPress,
  onPhotoPress,
  onHoursPress,
}: HeroProjectCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const handlePress = () => {
    hapticPatterns.tap();
    onPress();
  };

  const handlePhotoPress = () => {
    hapticPatterns.tap();
    onPhotoPress();
  };

  const handleHoursPress = () => {
    hapticPatterns.tap();
    onHoursPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`Project: ${projectName}`}
      >
        <LinearGradient
          colors={['#1A2E1A', '#0D1F0D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <Text style={styles.label}>VANDAAG OP LOCATIE</Text>
          <Text style={styles.projectName}>{projectName}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.pillsRow}>
            <Pressable onPress={handlePhotoPress} style={styles.pill} accessibilityRole="button" accessibilityLabel="Foto's toevoegen">
              <Camera size={12} color="#4ADE80" />
              <Text style={styles.pillTextGreen}>Foto's</Text>
            </Pressable>
            <Pressable onPress={handleHoursPress} style={styles.pill} accessibilityRole="button" accessibilityLabel="Start uren registratie">
              <Clock size={12} color="#CCCCCC" />
              <Text style={styles.pillTextGray}>Start uren</Text>
            </Pressable>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#2D5A27', '#4ADE80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${clampedProgress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{clampedProgress}%</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.19)',
    padding: 16,
  },
  label: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#4ADE80',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8E8E8',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#6B8F6B',
    marginBottom: 14,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,10,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillTextGreen: {
    fontSize: 11,
    color: '#4ADE80',
  },
  pillTextGray: {
    fontSize: 11,
    color: '#CCCCCC',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(10,10,10,0.25)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    fontSize: 9,
    color: '#555',
  },
});
