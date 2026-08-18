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
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useClerk } from '@clerk/clerk-expo';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { disableBiometric } from '../lib/auth/biometric';

export function GeenToegang() {
  const clerk = useClerk();
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
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Building2 size={40} color={colors.primary} />
      </View>

      <Text style={styles.title}>Nog geen toegang</Text>
      <Text style={styles.description}>
        Je account is nog niet aan een organisatie gekoppeld — vraag je beheerder om een
        uitnodiging.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Uitloggen"
        disabled={uitloggen}
        onPress={handleUitloggen}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          uitloggen && styles.buttonDisabled,
        ]}
      >
        {uitloggen ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <Text style={styles.buttonText}>Uitloggen</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.natureDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.lg,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 200,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.foreground,
  },
});

export default GeenToegang;
