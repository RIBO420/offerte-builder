import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Camera, Clock } from 'lucide-react-native';
import { hapticPatterns } from '../../theme/haptics';
import { tekst } from '../../theme/typography';
import { useIsDonker, useVeldKleuren } from '../veld/BuitenModus';

interface HeroProjectCardProps {
  projectName: string;
  description: string;
  progress: number;
  onPress: () => void;
  onPhotoPress: () => void;
  onHoursPress: () => void;
}

/**
 * Heldvlak voor het project van vandaag: het natuurverloop van de Kaart-
 * bouwsteen, met de gloed alleen op een donker canvas.
 */
export const HeroProjectCard = React.memo(function HeroProjectCard({
  projectName,
  description,
  progress,
  onPress,
  onPhotoPress,
  onHoursPress,
}: HeroProjectCardProps) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const rustig = useReducedMotion();
  const [ingedrukt, setIngedrukt] = useState(false);
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

  const pil = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: kleuren.card,
    borderWidth: 1,
    borderColor: kleuren.gradientBorder,
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setIngedrukt(true)}
      onPressOut={() => setIngedrukt(false)}
      accessibilityRole="button"
      accessibilityLabel={`Project: ${projectName}`}
    >
      <Animated.View
        style={[
          { borderRadius: 22 },
          donker && {
            shadowColor: kleuren.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.16,
            shadowRadius: 24,
            elevation: 6,
          },
          {
            transform: [{ scale: ingedrukt && !rustig ? 0.98 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
            transitionTimingFunction: 'ease-out',
          },
        ]}
      >
        <LinearGradient
          colors={[kleuren.gradientStart, kleuren.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 22, borderWidth: 1, borderColor: kleuren.gradientBorder, padding: 18 }}
        >
          <Text
            style={[
              tekst.voetnoot,
              { color: kleuren.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
            ]}
          >
            Vandaag op locatie
          </Text>
          <Text style={[tekst.titel3, { color: kleuren.foreground, marginBottom: 4 }]} numberOfLines={2}>
            {projectName}
          </Text>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginBottom: 16 }]} numberOfLines={2}>
            {description}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Pressable onPress={handlePhotoPress} hitSlop={4} style={pil} accessibilityRole="button" accessibilityLabel="Foto's toevoegen">
              <Camera size={16} color={kleuren.primary} />
              <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600' }]}>Foto&apos;s</Text>
            </Pressable>
            <Pressable onPress={handleHoursPress} hitSlop={4} style={pil} accessibilityRole="button" accessibilityLabel="Start uren registratie">
              <Clock size={16} color={kleuren.foreground} />
              <Text style={[tekst.voetnoot, { color: kleuren.foreground, fontWeight: '600' }]}>Start uren</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 6, backgroundColor: kleuren.primarySoft, borderRadius: 3, overflow: 'hidden' }}>
              {/* Absolute, kindloze vulling */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${clampedProgress}%`,
                  backgroundColor: kleuren.primary,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>{clampedProgress}%</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
});
