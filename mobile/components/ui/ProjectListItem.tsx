import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { hapticPatterns } from '../../theme/haptics';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

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
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  const [ingedrukt, setIngedrukt] = useState(false);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const progressColor = clampedProgress > 50 ? kleuren.success : kleuren.mutedForeground;

  const handlePress = () => {
    hapticPatterns.tap();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setIngedrukt(true)}
      onPressOut={() => setIngedrukt(false)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${scope}, ${clampedProgress} procent klaar`}
    >
      <Animated.View
        style={{
          backgroundColor: kleuren.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: kleuren.border,
          padding: 14,
          gap: 12,
          transform: [{ scale: ingedrukt && !rustig ? 0.96 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: 120,
          transitionTimingFunction: 'ease-out',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: kleuren.primarySoft,
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[tekst.kop, { color: kleuren.foreground, fontSize: 16 }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>
              {scope}
            </Text>
          </View>
          <Text style={[tekst.sub, tekst.cijfers, { color: progressColor, fontWeight: '600' }]}>
            {clampedProgress}%
          </Text>
        </View>
        <View style={{ height: 4, backgroundColor: kleuren.muted, borderRadius: 2, overflow: 'hidden' }}>
          {/* Absolute, kindloze vulling: breedte mag hier gewoon meegroeien. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${clampedProgress}%`,
              backgroundColor: kleuren.primary,
              borderRadius: 2,
            }}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
});
