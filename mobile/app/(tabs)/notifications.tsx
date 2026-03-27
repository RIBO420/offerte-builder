/**
 * Notifications Screen
 *
 * Toont een lijst van alle meldingen voor de ingelogde gebruiker.
 * Meldingen worden opgehaald via de Convex notifications API.
 */

import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  BellOff,
  FileText,
  MessageCircle,
  Hammer,
  ChevronLeft,
  CheckCheck,
  X,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';

// Time-ago formatting
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'nu';
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days < 7) return `${days} ${days === 1 ? 'dag' : 'dagen'} geleden`;
  return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'week' : 'weken'} geleden`;
}

// Pick an icon for a notification based on its type
function getNotificationIcon(type: string) {
  if (type.startsWith('offerte_')) {
    return <FileText size={18} color="#6B8F6B" />;
  }
  if (type.startsWith('chat_')) {
    return <MessageCircle size={18} color="#6B8F6B" />;
  }
  if (type.startsWith('project_')) {
    return <Hammer size={18} color="#6B8F6B" />;
  }
  return <Bell size={18} color="#6B8F6B" />;
}

type NotificationItem = {
  _id: string;
  _creationTime: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  projectId?: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { isLoading: isUserLoading, isUserSynced } = useCurrentUser();

  const notifications = useQuery(
    api.notifications.list,
    isUserSynced ? { limit: 50 } : 'skip'
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isUserSynced ? {} : 'skip'
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const dismissNotification = useMutation(api.notifications.dismiss);

  const isLoading = isUserLoading || notifications === undefined;
  const totalUnread = unreadCount?.total ?? 0;

  const handleNotificationPress = useCallback(
    (notif: NotificationItem) => {
      // Mark as read
      if (!notif.isRead) {
        markAsRead({ notificationId: notif._id as any });
      }

      // Navigate to related content
      if (notif.projectId) {
        router.push(`/project/${notif.projectId}`);
      }
    },
    [markAsRead, router]
  );

  const handleDismiss = useCallback(
    (notifId: string) => {
      dismissNotification({ notificationId: notifId as any });
    },
    [dismissNotification]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead({});
  }, [markAllAsRead]);

  const renderNotification = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.notificationItemUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          {getNotificationIcon(item.type)}
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[
                styles.notificationTitle,
                !item.isRead && styles.notificationTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimeAgo(item._creationTime)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => handleDismiss(item._id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={14} color="#555" />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleNotificationPress, handleDismiss]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <BellOff size={48} color="#333" />
        <Text style={styles.emptyTitle}>Geen meldingen</Text>
        <Text style={styles.emptySubtitle}>
          Je bent helemaal bij! Nieuwe meldingen verschijnen hier.
        </Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex1} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color="#E8E8E8" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Meldingen</Text>
            {totalUnread > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </View>
          {totalUnread > 0 ? (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllAsRead}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CheckCheck size={18} color="#4ADE80" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loadingText}>Laden...</Text>
          </View>
        ) : (
          <FlatList
            data={(notifications as NotificationItem[]) ?? []}
            keyExtractor={(item) => item._id}
            renderItem={renderNotification}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={
              (notifications?.length ?? 0) === 0
                ? styles.emptyListContainer
                : styles.listContainer
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={false}
                tintColor="#4ADE80"
                colors={['#4ADE80']}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  headerBadge: {
    backgroundColor: '#4ADE80',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  headerSpacer: {
    width: 36,
  },
  markAllButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationItemUnread: {
    backgroundColor: '#0D1A0D',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A2E1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C0C0C0',
    flex: 1,
  },
  notificationTitleUnread: {
    color: '#E8E8E8',
    fontWeight: '600',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
  dismissButton: {
    padding: 4,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#555',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
});
