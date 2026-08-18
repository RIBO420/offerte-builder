/**
 * Zorgt dat er een actieve Clerk-organisatie is voordat er ook maar één
 * org-gescoopte Convex-query afgaat.
 *
 * De Convex-backend leest `org_id` uit het JWT (`requireOrg`). Clerk vult dat
 * claim alleen als de sessie een *actieve* organisatie heeft — lid zijn is niet
 * genoeg. Iedereen zit hier in precies één organisatie, dus die zetten we
 * automatisch actief; de gebruiker hoeft niets te kiezen.
 *
 * Zelfde logica als de web-gate (`src/components/providers/org-gate.tsx`), met
 * één mobiel verschil: uitgelogd wordt er dóórgelaten. De gate zit namelijk om
 * de hele expo-router-tree, en daar zitten de `(auth)`-loginschermen in — die
 * moeten juist zónder organisatie kunnen renderen.
 *
 * Vier uitkomsten:
 * - niet ingelogd → children (loginflow);
 * - actieve org → children;
 * - lid, nog niet actief → laadstaat terwijl `setActive` loopt;
 * - geen lidmaatschap (of `setActive` mislukt) → `GeenToegang`.
 *
 * De mobiele app is staf-only (rollen admin/medewerker/viewer uit Convex); er is
 * geen klantenportaal in de app, dus de gate mag om alles heen.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth, useOrganizationList } from '@clerk/clerk-expo';
import { colors } from '../theme/colors';
import { GeenToegang } from './GeenToegang';

export function OrgGate({ children }: { children: ReactNode }) {
  const { isLoaded: authGeladen, isSignedIn, orgId } = useAuth();
  // @clerk/clerk-expo her-exporteert useOrganizationList uit @clerk/clerk-react,
  // dus dezelfde union-shape als op web: in de niet-geladen tak zijn setActive en
  // createOrganization `undefined`.
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  });
  // Eén mislukte setActive maakt de gate niet stil-oneindig: we tonen de
  // no-access-staat in plaats van eeuwig te blijven laden, en proberen het niet
  // in een lus opnieuw.
  const [setActiveMislukt, setSetActiveMislukt] = useState(false);

  const eersteOrgId = userMemberships?.data?.[0]?.organization?.id;
  // In de niet-geladen tak van Clerk's union is dit `false`; pas na isLoaded
  // zegt het iets. Zonder deze vlag flitst GeenToegang tijdens het ophalen van
  // de lidmaatschappen.
  const ledenLaden = userMemberships?.isLoading ?? false;

  useEffect(() => {
    if (!isSignedIn || !isLoaded || orgId || !eersteOrgId || !setActive || setActiveMislukt) {
      return;
    }
    void Promise.resolve(setActive({ organization: eersteOrgId })).catch((fout: unknown) => {
      console.error(
        '[OrgGate] Actieve organisatie zetten mislukt — no-access-staat getoond',
        fout
      );
      setSetActiveMislukt(true);
    });
  }, [isSignedIn, isLoaded, orgId, eersteOrgId, setActive, setActiveMislukt]);

  // Uitgelogd (of Clerk nog niet klaar met de sessie): doorlaten, anders komt de
  // gebruiker nooit bij het loginscherm.
  if (!authGeladen || !isSignedIn) return <>{children}</>;
  if (!isLoaded || ledenLaden) return <Laadstaat />;
  if (orgId) return <>{children}</>;
  if (!eersteOrgId || setActiveMislukt) return <GeenToegang />;
  // Lid, maar de organisatie is nog niet actief: setActive loopt.
  return <Laadstaat />;
}

function Laadstaat() {
  return (
    <View style={styles.laadstaat}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  laadstaat: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OrgGate;
