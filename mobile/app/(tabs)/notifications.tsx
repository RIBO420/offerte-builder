import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '../../convex/_generated/api';
import { useColors } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Button, Badge, Card } from '../../components/ui';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import type { Id, Doc } from '../../convex/_generated/dataModel';

type Notification = Doc<'notifications'>;

// Helper function to format timestamps in Dutch
function formatTimestamp(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Zojuist';
  } else if (diffMins < 60) {
    return `${diffMins} min geleden`;
  } else if (diffHours < 24) {
    return `${diffHours} uur geleden`;
  } else if (diffDays === 1) {
    return 'Gisteren';
  } else if (diffDays < 7) {
    return `${diffDays} dagen geleden`;
  } else {
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    });
  }
}

// Get icon for notification type
function getNotificationIcon(type: string): { name: keyof typeof Feather.glyphMap; color: string } {
  if (type.startsWith('offerte_')) {
    switch (type) {
      case 'offerte_geaccepteerd':
        return { name: 'check-circle', color: '#22C55E' };
      case 'offerte_afgewezen':
        return { name: 'x-circle', color: '#EF4444' };
      case 'offerte_bekeken':
        return { name: 'eye', color: '#3B82F6' };
      case 'offerte_verzonden':
        return { name: 'send', color: '#8B5CF6' };
      default:
        return { name: 'file-text', color: '#6B7280' };
    }
  } else if (type.startsWith('chat_')) {
    return { name: 'message-circle', color: '#2D5A27' };
  } else if (type.startsWith('project_')) {
    return { name: 'briefcase', color: '#F97316' };
  } else if (type.startsWith('system_')) {
    return { name: 'bell', color: '#6366F1' };
  }
  return { name: 'bell', color: '#6B7280' };
}

// Swipeable notification item component
function NotificationItem({
  notification,
  onPress,
  onDismiss,
  colors,
}: {
  notification: Notification;
  onPress: () => void;
  onDismiss: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const itemHeight = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          // Swipe left to dismiss
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            Animated.timing(itemHeight, {
              toValue: 0,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              onDismiss();
            });
          });
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const icon = getNotificationIcon(notification.type);

  return (
    <Animated.View
      style={[
        styles.notificationWrapper,
        {
          height: itemHeight,
          opacity,
        },
      ]}
    >
      {/* Delete background */}
      <View style={[styles.deleteBackground, { backgroundColor: colors.destructive }]}>
        <Feather name="trash-2" size={20} color="#fff" />
        <Text style={styles.deleteText}>Verwijderen</Text>
      </View>

      {/* Notification card */}
      <Animated.View
        style={[
          styles.notificationItem,
          {
            backgroundColor: notification.isRead ? colors.background : colors.card,
            borderColor: colors.border,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.notificationContent}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${icon.color}20` },
            ]}
          >
            <Feather name={icon.name} size={20} color={icon.color} />
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.foreground,
                    fontWeight: notification.isRead ? '400' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              {!notification.isRead && (
                <View style={[styles.unreadDot, { backgroundColor: colors.destructive }]} />
              )}
            </View>
            <Text
              style={[styles.message, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {notification.message}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatTimestamp(notification.createdAt)}
            </Text>
          </View>

          {/* Chevron */}
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// Wrapper component that handles auth check
export default function NotificationsScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.mutedForeground }}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedNotificationsScreen />;
}

// Separate component that only renders when authenticated
function AuthenticatedNotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const notifications = useQuery(api.notifications.list, { limit: 50, includeRead: true });
  const unreadCounts = useQuery(api.notifications.getUnreadCount);

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const dismiss = useMutation(api.notifications.dismiss);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      // Mark as read
      if (!notification.isRead) {
        await markAsRead({ notificationId: notification._id });
      }

      // Navigate based on notification type
      if (notification.type.startsWith('offerte_') && notification.offerteId) {
        // Navigate to offerte (if screen exists)
        // router.push(`/offerte/${notification.offerteId}`);
      } else if (notification.type.startsWith('chat_')) {
        // Navigate to chat screen
        router.push('/(tabs)/chat');
      } else if (notification.type.startsWith('project_') && notification.projectId) {
        // Navigate to project (if screen exists)
        // router.push(`/project/${notification.projectId}`);
      }
    },
    [markAsRead, router]
  );

  const handleDismiss = useCallback(
    async (notificationId: Id<'notifications'>) => {
      await dismiss({ notificationId });
    },
    [dismiss]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead({});
  }, [markAllAsRead]);

  const isLoading = notifications === undefined;
  const hasUnread = (unreadCounts?.total || 0) > 0;

  // Render notification item
  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        notification={item}
        onPress={() => handleNotificationPress(item)}
        onDismiss={() => handleDismiss(item._id)}
        colors={colors}
      />
    ),
    [handleNotificationPress, handleDismiss, colors]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Meldingen</Text>
          {hasUnread && (
            <Badge variant="destructive" size="sm">
              {unreadCounts?.total}
            </Badge>
          )}
        </View>
        {hasUnread && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>
              Alles gelezen
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Meldingen laden...
          </Text>
        </View>
      ) : !notifications || notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="bell-off" size={48} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Geen meldingen
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Je hebt nog geen meldingen ontvangen. Meldingen over offertes, chat en projecten verschijnen hier.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        />
      )}

      {/* Swipe hint */}
      {notifications && notifications.length > 0 && (
        <View style={[styles.hintContainer, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Swipe naar links om te verwijderen
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    maxWidth: 280,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  notificationWrapper: {
    overflow: 'hidden',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.lg,
    gap: spacing.xs,
  },
  deleteText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  notificationItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  message: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  time: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hintText: {
    fontSize: typography.fontSize.xs,
  },
});
