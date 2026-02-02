import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Home, Clock, MessageCircle, Bell, User } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useColors, useTheme } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole, type NormalizedRole } from '../../hooks/use-user-role';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { typography } from '../../theme/typography';

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
  IconComponent,
  color,
  size,
  badgeCount,
}: {
  IconComponent: React.ComponentType<{ color: string; size: number }>;
  color: string;
  size: number;
  badgeCount?: number;
}) {
  return (
    <View style={styles.iconContainer}>
      <IconComponent color={color} size={size} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <TabBarBadge count={badgeCount} color={color} />
      )}
    </View>
  );
}

// Role badge component for header
function RoleBadge({
  role,
  displayName,
  colors: roleColors,
}: {
  role: NormalizedRole;
  displayName: string;
  colors: { background: string; text: string };
}) {
  return (
    <View style={[styles.roleBadge, { backgroundColor: roleColors.background }]}>
      <Text style={[styles.roleBadgeText, { color: roleColors.text }]}>
        {displayName}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, isUserSynced } = useCurrentUser();
  const {
    isAdmin,
    isMedewerker,
    isViewer,
    roleDisplayName,
    normalizedRole,
    roleBadgeColors,
    permissions,
  } = useUserRole();

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
        tabBarActiveTintColor: '#fafafa',
        tabBarInactiveTintColor: '#71717a',
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
      {/* Dashboard - visible to all, shows role badge */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <RoleBadge
                role={normalizedRole}
                displayName={roleDisplayName}
                colors={roleBadgeColors}
              />
            </View>
          ),
        }}
      />

      {/* Uren - visible to all */}
      <Tabs.Screen
        name="uren"
        options={{
          title: 'Urenregistratie',
          tabBarLabel: 'Uren',
          tabBarIcon: ({ color, size }) => (
            <Clock color={color} size={size} />
          ),
        }}
      />

      {/* Chat - visible to all */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Team Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <TabBarIconWithBadge
              IconComponent={MessageCircle}
              color={color}
              size={size}
              badgeCount={chatBadgeCount}
            />
          ),
        }}
      />

      {/* Meldingen - visible to all */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Meldingen',
          tabBarLabel: 'Meldingen',
          tabBarIcon: ({ color, size }) => (
            <TabBarIconWithBadge
              IconComponent={Bell}
              color={color}
              size={size}
              badgeCount={notificationBadgeCount}
            />
          ),
        }}
      />

      {/* Profiel - visible to all */}
      <Tabs.Screen
        name="profiel"
        options={{
          title: 'Profiel',
          tabBarLabel: 'Profiel',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
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
  headerRight: {
    paddingRight: 16,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
