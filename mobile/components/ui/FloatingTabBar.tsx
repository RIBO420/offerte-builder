import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Camera,
  Clock,
  MessageCircle,
  User,
} from 'lucide-react-native';
import { hapticPatterns } from '../../theme/haptics';
import { useColors, useTheme } from '../../theme/ThemeProvider';
const ICON_SIZE = 22;

const routeIcons: Record<string, React.ComponentType<any>> = {
  index: Home,
  fotos: Camera,
  uren: Clock,
  chat: MessageCircle,
  profiel: User,
};

const routeLabels: Record<string, string> = {
  index: 'Home',
  fotos: "Foto's",
  uren: 'Uren',
  chat: 'Chat',
  profiel: 'Profiel',
};

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const kleuren = useColors();
  const IconComponent = routeIcons[route.name] ?? Home;
  const label = routeLabels[route.name] ?? route.name;
  const kleur = isFocused ? kleuren.primary : kleuren.inactive;

  // Tabwissels gebeuren tientallen keren per dag: geen schaalanimatie, alleen
  // een selectie-haptic en een directe kleurwissel.
  return (
    <Pressable
      onPress={() => { hapticPatterns.selection(); onPress(); }}
      onLongPress={onLongPress}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <View style={styles.tabContent}>
        <IconComponent size={ICON_SIZE} color={kleur} strokeWidth={isFocused ? 2.2 : 1.8} />
        <Text style={[styles.label, { color: kleur, fontWeight: isFocused ? '600' : '500' }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors: kleuren, isDark } = useTheme();

  // Routes met href:null verbergen. expo-router vertaalt dat naar tabBarButton:() => null,
  // wat de standaard React Navigation-balk respecteert maar deze custom balk niet —
  // vandaar dat verborgen routes hier eerder als naamloze tabs verschenen.
  const zichtbareRoutes = state.routes.filter(
    (route) => descriptors[route.key]?.options.tabBarButton === undefined
  );

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.container, { borderColor: kleuren.border, shadowOpacity: isDark ? 0.4 : 0.1 }]}>
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={styles.blur}>
          <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(17,17,17,0.82)' : 'rgba(255,255,255,0.78)' }]}>
            {zichtbareRoutes.map((route) => {
              // Vergelijk tegen de ORIGINELE index: state.index verwijst naar
              // state.routes, niet naar de gefilterde lijst.
              const index = state.routes.indexOf(route);
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <TabItem
                  key={route.key}
                  route={route}
                  isFocused={isFocused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
  },
  blur: {
    overflow: 'hidden',
  },
  overlay: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 3,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
