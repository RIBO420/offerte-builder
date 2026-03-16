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
      <Tabs.Screen name="fotos" />
      <Tabs.Screen name="uren" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profiel" />
    </Tabs>
  );
}
