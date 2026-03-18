import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole } from '../../hooks/use-user-role';
import { Bell, Leaf, Hammer, TreePine, Shovel } from 'lucide-react-native';

// Theme system
import { useColors } from '../../theme';

// UI Components
import {
  HeroProjectCard,
  NotificationBanner,
  ProjectListItem,
  Skeleton,
  SkeletonCard,
} from '../../components/ui';

// Time formatting helper
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

// Greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

// Format currency helper
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Time-ago formatting for notifications
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'nu';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}u`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Pick an icon for a project based on its type/name
function getProjectIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes('tuin') || lower.includes('groen') || lower.includes('plant')) {
    return <Leaf size={16} color="#6B8F6B" />;
  }
  if (lower.includes('terras') || lower.includes('bestrat') || lower.includes('aanleg')) {
    return <Shovel size={16} color="#6B8F6B" />;
  }
  if (lower.includes('boom') || lower.includes('snoei')) {
    return <TreePine size={16} color="#6B8F6B" />;
  }
  return <Hammer size={16} color="#6B8F6B" />;
}

// Pick an icon for a notification based on its type
function getNotificationIcon(type: string): React.ReactNode {
  if (type.startsWith('offerte_')) {
    return <Feather name="file-text" size={16} color="#6B8F6B" />;
  }
  if (type.startsWith('chat_')) {
    return <Feather name="message-circle" size={16} color="#6B8F6B" />;
  }
  if (type.startsWith('project_')) {
    return <Hammer size={16} color="#6B8F6B" />;
  }
  return <Bell size={16} color="#6B8F6B" />;
}

// Wrapper component that handles auth check
export default function DashboardScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  if (isLoading || !isUserSynced) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.flex1} edges={['top']}>
          <View style={styles.loadingContainer}>
            <Skeleton width={200} height={24} style={{ marginBottom: 16 }} />
            <Skeleton width={150} height={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return <AuthenticatedDashboard />;
}

// Separate component that only renders when authenticated
function AuthenticatedDashboard() {
  const colors = useColors();
  const router = useRouter();
  const { isAdmin, isMedewerker } = useUserRole();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Queries
  const profile = useQuery(api.medewerkers.getActive);
  const projectStats = useQuery(api.projecten.getStats);
  const activeProjects = useQuery(api.projecten.getActiveProjectsWithProgress);

  const isDataLoading = profile === undefined;
  const planningProjects = useQuery(
    api.projecten.listForPlanning,
    isMedewerker ? {} : 'skip'
  );
  const offerteStats = useQuery(api.offertes.getStats, isAdmin ? {} : 'skip');
  const revenueStats = useQuery(api.offertes.getRevenueStats, isAdmin ? {} : 'skip');

  // Notification queries
  const notifications = useQuery(api.notifications.list, { limit: 5 });
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const dismissNotification = useMutation(api.notifications.dismiss);

  const userName = profile?.[0]?.naam || 'Medewerker';

  // Mock session state
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer effect - store interval ID in ref for reliable cleanup
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (isClockedIn && sessionStartTime) {
      timerIntervalRef.current = setInterval(() => {
        setCurrentTime(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      setCurrentTime(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isClockedIn, sessionStartTime]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleClockIn = () => {
    setIsClockingIn(true);
    setTimeout(() => {
      setIsClockedIn(true);
      setSessionStartTime(Date.now());
      setIsClockingIn(false);
    }, 500);
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    setSessionStartTime(null);
    setCurrentTime(0);
  };

  // Week data
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const currentDayIndex = new Date().getDay();
  const adjustedDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
  const weeklyHours = [8.5, 7.0, 6.5, 0, 0, 0, 0];
  const todayHours = weeklyHours[adjustedDayIndex] + (currentTime / 3600);
  const totalWeekHours = weeklyHours.reduce((sum, h) => sum + h, 0) + (isClockedIn ? currentTime / 3600 : 0);

  // Derive hero project: first planning project (medewerker) or first active project (admin)
  const heroProject = isMedewerker
    ? planningProjects?.[0]
    : activeProjects?.[0];

  // Other projects (all except hero)
  const otherProjects = isMedewerker
    ? (planningProjects?.slice(1) || [])
    : (activeProjects?.slice(1) || []);

  const totalUnread = unreadCount?.total || 0;
  const latestNotifications = notifications?.slice(0, 5) || [];

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex1} edges={['top']}>
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.content}>
            {/* ── Header Row ── */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.brandLabel}>TOP TUINEN</Text>
                <Text style={styles.greeting}>Hoi {userName}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications')}
                activeOpacity={0.7}
                style={styles.bellButton}
              >
                <Bell size={22} color="#E8E8E8" />
                {totalUnread > 0 && <View style={styles.bellBadge} />}
              </TouchableOpacity>
            </View>

            {/* ── Hero Project Card ── */}
            {isDataLoading ? (
              <View style={{ marginBottom: 16 }}>
                <SkeletonCard lines={4} />
              </View>
            ) : heroProject ? (
              <View style={{ marginBottom: 16 }}>
                <HeroProjectCard
                  projectName={heroProject.naam}
                  description={
                    ('klantNaam' in heroProject ? heroProject.klantNaam : '') ||
                    ('scope' in heroProject ? String(heroProject.scope) : '') ||
                    'Vandaag ingepland'
                  }
                  progress={'voortgang' in heroProject ? (heroProject.voortgang as number) : 0}
                  onPress={() => router.push(`/project/${heroProject._id}`)}
                  onPhotoPress={() => router.push(`/project/${heroProject._id}`)}
                  onHoursPress={() => router.push('/(tabs)/uren')}
                />
              </View>
            ) : (
              <View style={styles.emptyHero}>
                <Leaf size={28} color="#333" />
                <Text style={styles.emptyHeroTitle}>Geen project vandaag</Text>
                <Text style={styles.emptyHeroSubtitle}>Geniet van je vrije dag</Text>
              </View>
            )}

            {/* ── Section: MELDINGEN ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>MELDINGEN</Text>
              {totalUnread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{totalUnread} nieuw</Text>
                </View>
              )}
            </View>

            {notifications === undefined ? (
              <View style={{ gap: 8, marginBottom: 16 }}>
                <SkeletonCard lines={1} />
                <SkeletonCard lines={1} />
              </View>
            ) : latestNotifications.length > 0 ? (
              <View style={{ gap: 8, marginBottom: 8 }}>
                {latestNotifications.map((notif) => (
                  <NotificationBanner
                    key={notif._id}
                    icon={getNotificationIcon(notif.type)}
                    title={notif.title}
                    subtitle={notif.message}
                    time={formatTimeAgo(notif._creationTime)}
                    isUnread={!notif.isRead}
                    onPress={() => {
                      markAsRead({ notificationId: notif._id });
                      if (notif.projectId) {
                        router.push(`/project/${notif.projectId}`);
                      }
                    }}
                    onDismiss={() => {
                      dismissNotification({ notificationId: notif._id });
                    }}
                  />
                ))}
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/notifications')}
                  activeOpacity={0.7}
                  style={styles.viewAllLink}
                >
                  <Text style={styles.viewAllText}>Bekijk alles →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyNotifications}>
                <Text style={styles.emptyNotificationsText}>Geen meldingen</Text>
              </View>
            )}

            {/* ── Section: ANDERE PROJECTEN ── */}
            {otherProjects.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>ANDERE PROJECTEN</Text>
                </View>
                <FlatList
                  data={otherProjects}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={{ gap: 10, paddingRight: 16 }}
                  style={{ marginBottom: 16 }}
                  getItemLayout={(_, index) => ({
                    length: 200,
                    offset: (200 + 10) * index,
                    index,
                  })}
                  renderItem={({ item }) => (
                    <View style={{ width: 200 }}>
                      <ProjectListItem
                        name={item.naam}
                        scope={
                          ('klantNaam' in item ? item.klantNaam : '') ||
                          ('status' in item ? String(item.status) : '')
                        }
                        progress={'voortgang' in item ? (item.voortgang as number) : 0}
                        icon={getProjectIcon(item.naam)}
                        onPress={() => router.push(`/project/${item._id}`)}
                      />
                    </View>
                  )}
                />
              </>
            )}

            {/* Bottom spacer for FloatingTabBar clearance */}
            <View style={{ height: 100 }} />
          </View>
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#6B8F6B',
    marginBottom: 2,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#0A0A0A',
  },
  // Empty hero
  emptyHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 16,
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  emptyHeroTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
  },
  emptyHeroSubtitle: {
    fontSize: 11,
    color: '#333',
    marginTop: 4,
  },
  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#555',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
  // View all link
  viewAllLink: {
    paddingVertical: 8,
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 11,
    color: '#6B8F6B',
    fontWeight: '500',
  },
  // Empty notifications
  emptyNotifications: {
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyNotificationsText: {
    fontSize: 11,
    color: '#444',
  },
});
