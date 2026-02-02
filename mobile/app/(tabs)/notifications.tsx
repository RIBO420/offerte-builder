import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
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
import { Badge } from '../../components/ui';
import { cn } from '../../lib/utils';
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
      className="overflow-hidden"
      style={{
        height: itemHeight,
        opacity,
      }}
    >
      {/* Delete background */}
      <View
        className="absolute right-0 top-0 bottom-0 w-[120px] flex-row items-center justify-end pr-4 gap-1"
        style={{ backgroundColor: colors.destructive }}
      >
        <Feather name="trash-2" size={20} color="#fff" />
        <Text className="text-white text-sm font-medium">Verwijderen</Text>
      </View>

      {/* Notification card */}
      <Animated.View
        className={cn(
          "px-4 py-3 border-b",
          notification.isRead ? "bg-background" : "bg-card"
        )}
        style={{
          borderColor: colors.border,
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          className="flex-row items-center gap-4"
          onPress={onPress}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: `${icon.color}20` }}
          >
            <Feather name={icon.name} size={20} color={icon.color} />
          </View>

          {/* Content */}
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text
                className={cn(
                  "flex-1 text-base text-foreground",
                  notification.isRead ? "font-normal" : "font-semibold"
                )}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              {!notification.isRead && (
                <View
                  className="w-2 h-2 rounded-full bg-accent"
                />
              )}
            </View>
            <Text
              className="text-sm text-muted-foreground leading-tight"
              numberOfLines={2}
            >
              {notification.message}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
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
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted-foreground">Laden...</Text>
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 bg-card border-b"
        style={{ borderBottomColor: colors.border }}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl font-bold text-foreground">Meldingen</Text>
          {hasUnread && (
            <Badge variant="destructive" size="sm">
              {unreadCounts?.total}
            </Badge>
          )}
        </View>
        {hasUnread && (
          <TouchableOpacity onPress={handleMarkAllAsRead} className="px-2 py-1">
            <Text className="text-sm font-medium" style={{ color: colors.primary }}>
              Alles gelezen
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted-foreground">
            Meldingen laden...
          </Text>
        </View>
      ) : !notifications || notifications.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6 gap-4">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: colors.muted }}
          >
            <Feather name="bell-off" size={48} color={colors.mutedForeground} />
          </View>
          <Text className="text-lg font-semibold text-foreground">
            Geen meldingen
          </Text>
          <Text className="text-base text-muted-foreground text-center leading-relaxed max-w-[280px]">
            Je hebt nog geen meldingen ontvangen. Meldingen over offertes, chat en projecten verschijnen hier.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View className="h-px" />}
        />
      )}

      {/* Swipe hint */}
      {notifications && notifications.length > 0 && (
        <View
          className="flex-row items-center justify-center gap-1 py-3 px-4"
          style={{ backgroundColor: colors.muted }}
        >
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground">
            Swipe naar links om te verwijderen
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

