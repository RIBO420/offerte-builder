import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/ui';

export default function TabLayout() {
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
