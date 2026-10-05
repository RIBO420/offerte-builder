/**
 * No-access-staat voor een ingelogde stafgebruiker zonder organisatie.
 *
 * De Convex-backend is volledig org-gescoped: zonder `org_id`-claim in het
 * Clerk-token gooit elke staf-query dezelfde melding. Zonder deze staat zag zo'n
 * gebruiker een app die overal foutmeldingen opwerpt of leeg blijft — nu krijgt
 * hij één duidelijke zin en de enige knop die hier zin heeft.
 *
 * Tekst is bewust identiek aan de web-variant
 * (`src/app/(dashboard)/geen-toegang/geen-toegang.tsx`).
 *
 * Uitloggen gaat rechtstreeks via `clerk.signOut()` en dus *niet* via
 * `useAppAuth().signOut` — die doet een `router.replace`, en dit scherm draait
 * in `OrgGate` op een moment dat de expo-router `Stack` niet gemonteerd is.
 * Na het uitloggen valt de gate terug op zijn doorlaat-tak, komt de navigator
 * weer op en stuurt `app/index.tsx` de gebruiker naar het loginscherm.
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useClerk } from '@clerk/clerk-expo';
import { spacing } from '../theme/spacing';
import { tekst } from '../theme/typography';
import { useVeldKleuren } from './veld/BuitenModus';
import { disableBiometric } from '../lib/auth/biometric';

export function GeenToegang({ uitleg }: { uitleg?: string } = {}) {
  const clerk = useClerk();
  const kleuren = useVeldKleuren();
  const [uitloggen, setUitloggen] = useState(false);

  const handleUitloggen = useCallback(async () => {
    setUitloggen(true);
    try {
      // Zelfde opruiming als useAppAuth.signOut: een biometrische sessie van een
      // account zonder toegang moet niet blijven staan.
      await disableBiometric();
      await clerk.signOut();
    } catch (fout) {
      console.error('[GeenToegang] Uitloggen mislukt:', fout);
      setUitloggen(false);
    }
  }, [clerk]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: kleuren.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: kleuren.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Building2 size={38} color={kleuren.primary} />
      </View>

      <Text accessibilityRole="header" style={[tekst.titel2, { color: kleuren.foreground, marginBottom: spacing.sm, textAlign: 'center' }]}>
        Nog geen toegang
      </Text>
      <Text style={[tekst.body, { color: kleuren.mutedForeground, textAlign: 'center', marginBottom: spacing.xl, maxWidth: 340 }]}>
        {uitleg ?? 'Je account is nog niet aan een organisatie gekoppeld — vraag je beheerder om een uitnodiging.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Uitloggen"
        accessibilityState={{ disabled: uitloggen, busy: uitloggen }}
        disabled={uitloggen}
        onPress={handleUitloggen}
        style={({ pressed }) => ({
          minHeight: 48,
          minWidth: 200,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.sm + 4,
          paddingHorizontal: spacing.xl,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: kleuren.border,
          backgroundColor: pressed ? kleuren.muted : kleuren.card,
          opacity: uitloggen ? 0.6 : 1,
        })}
      >
        {uitloggen ? (
          <ActivityIndicator size="small" color={kleuren.foreground} />
        ) : (
          <Text style={[tekst.kop, { color: kleuren.foreground }]}>Uitloggen</Text>
        )}
      </Pressable>
    </View>
  );
}

export default GeenToegang;
