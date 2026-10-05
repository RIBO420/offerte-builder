import { ActivityIndicator, View } from 'react-native';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isInternalRole } from '../../lib/roles';
import { GeenToegang } from '../../components/GeenToegang';
import { Redirect, Tabs } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { introIsBevestigd, introScope } from '../../lib/intro-status';
import { api } from '../../convex/_generated/api';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { FloatingTabBar } from '../../components/ui';

export default function TabLayout() {
  const { isLoading, role } = useCurrentUser();
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Account laden" /></View>;
  if (!isInternalRole(role)) return <GeenToegang uitleg={role === 'klant' ? 'Deze app is voor medewerkers. Gebruik het klantportaal om je project te volgen.' : 'Je account heeft nog geen geldige medewerkersrol. Vraag kantoor om je toegang te controleren.'} />;
  return <MedewerkerTabs />;
}

function MedewerkerTabs() {
  const { orgId, userId } = useAuth();
  const liveIntro = useQuery(api.appVoorkeuren.getIntro, {});
  const { data: intro } = useVeldCache('intro', liveIntro);
  const { wachtrij } = useVeldOpdracht();
  const introBewaard = wachtrij.some(opdracht => opdracht.type === 'intro' && opdracht.status !== 'conflict');
  if (intro?.gezien === false && !introBewaard && !introIsBevestigd(introScope(orgId, userId))) return <Redirect href="/werk/intro" />;
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="uren" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profiel" />
      {/* expo-router registreert ELK bestand in (tabs)/ als route, ook wat hier niet
          gedeclareerd staat. Zonder href:null verschijnen deze als naamloze tabs.
          FloatingTabBar filtert er zelf op — href:null alleen is niet genoeg bij een
          custom tab bar. Zie docs/MOBILE-AUDIT.md (H1, B5). */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="fotos" options={{ href: null }} />
    </Tabs>
  );
}
