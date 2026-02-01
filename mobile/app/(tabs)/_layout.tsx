import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useColors, useTheme } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';

// Badge component for tab bar icon
function TabBarBadge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

// Tab bar icon with optional badge
function TabBarIconWithBadge({
  iconName,
  color,
  size,
  badgeCount,
}: {
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  size: number;
  badgeCount?: number;
}) {
  return (
    <View style={styles.iconContainer}>
      <Feather name={iconName} size={size} color={color} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <TabBarBadge count={badgeCount} color={color} />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, isUserSynced } = useCurrentUser();

  // Query unread notification count for badge (skip when not authenticated)
  const unreadCounts = useQuery(
    api.notifications.getUnreadCount,
    isUserSynced && user?._id ? {} : 'skip'
  );
  const notificationBadgeCount = unreadCounts?.total || 0;

  // Query unread chat message count for badge (skip when not authenticated)
  const chatUnreadCounts = useQuery(
    api.chat.getUnreadCounts,
    isUserSynced && user?._id ? {} : 'skip'
  );
  const chatBadgeCount = chatUnreadCounts?.total || 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.scope.borders,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTitleStyle: {
          color: colors.foreground,
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="uren"
        options={{
          title: 'Urenregistratie',
          tabBarLabel: 'Uren',
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Meldingen',
          tabBarLabel: 'Meldingen',
          tabBarIcon: ({ color, size }) => (
            <TabBarIconWithBadge
              iconName="bell"
              color={color}
              size={size}
              badgeCount={notificationBadgeCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Team Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <TabBarIconWithBadge
              iconName="message-circle"
              color={color}
              size={size}
              badgeCount={chatBadgeCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profiel"
        options={{
          title: 'Profiel',
          tabBarLabel: 'Profiel',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
