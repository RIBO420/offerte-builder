import React from 'react';
import { Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { Button } from '../ui';
import { useVeldKleuren } from './BuitenModus';

/**
 * Rustige verwijderknop: grijze (ghost) of omlijnde pil met rood icoon en rode
 * tekst. Geen volle rode knop; de bevestiging hoort in de aanroeper (Alert).
 */
export function VerwijderKnop({ title, onPress, disabled, variant = 'ghost', size = 'md', fullWidth, accessibilityLabel }: {
  title: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; variant?: 'ghost' | 'outline'; size?: 'sm' | 'md'; fullWidth?: boolean;
}) {
  const kleuren = useVeldKleuren();
  return <Button title={title} accessibilityLabel={accessibilityLabel} variant={variant} size={size} disabled={disabled} onPress={onPress} fullWidth={fullWidth}>
    <View className={size === 'sm' ? 'flex-row items-center justify-center gap-1' : 'flex-row items-center justify-center gap-2'}>
      <Trash2 size={16} color={kleuren.danger} strokeWidth={2} />
      <Text className={size === 'sm' ? 'font-sans font-semibold text-center text-sm' : 'font-sans font-semibold text-center text-base'} style={{ color: kleuren.danger }} numberOfLines={1}>{title}</Text>
    </View>
  </Button>;
}
