import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';

// Theme system
import { useColors, useTheme } from '../../theme';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';

// UI Components
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusBadge,
  AnimatedNumber,
  Skeleton,
  SkeletonCard,
} from '../../components/ui';

// Dutch date formatting
function formatDutchDate(date: Date): string {
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];

  const dayName = days[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName} ${dayNumber} ${monthName} ${year}`;
}

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

// Loading skeleton components
function DashboardSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.content}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <Skeleton width={120} height={18} />
        <View style={{ marginTop: spacing.xs }}>
          <Skeleton width={180} height={28} />
        </View>
        <View style={{ marginTop: spacing.xs }}>
          <Skeleton width={200} height={14} />
        </View>
      </View>

      {/* Status card skeleton */}
      <SkeletonCard lines={4} />

      {/* Stats skeleton */}
      <View style={{ marginTop: spacing.lg }}>
        <SkeletonCard lines={2} />
      </View>

      {/* Week summary skeleton */}
      <View style={{ marginTop: spacing.lg }}>
        <SkeletonCard lines={5} />
      </View>
    </View>
  );
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

// Wrapper component that handles auth check
export default function DashboardScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced to Convex
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DashboardSkeleton colors={colors} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Only render the authenticated content when user is synced
  return <AuthenticatedDashboard />;
}

// Separate component that only renders when authenticated
function AuthenticatedDashboard() {
  const colors = useColors();
  const { isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const profile = useQuery(api.medewerkers.getActive);
  const projectStats = useQuery(api.projecten.getStats);
  const activeProjects = useQuery(api.projecten.getActiveProjectsWithProgress);

  // Financial queries
  const offerteStats = useQuery(api.offertes.getStats);
  const revenueStats = useQuery(api.offertes.getRevenueStats);

  // Get user name from first active medewerker or default
  const userName = profile?.[0]?.naam || 'Medewerker';

  // Mock active session state (replace with real Convex query when available)
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  // Timer effect when clocked in
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isClockedIn && sessionStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        setCurrentTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClockedIn, sessionStartTime]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Convex queries auto-refresh, but we can add a delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Clock in/out handlers
  const handleClockIn = () => {
    setIsClockingIn(true);
    // Simulate clock in
    setTimeout(() => {
      setIsClockedIn(true);
      setSessionStartTime(Date.now());
      setCurrentProject(activeProjects?.[0]?.naam || 'Algemeen');
      setIsClockingIn(false);
    }, 500);
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    setSessionStartTime(null);
    setCurrentTime(0);
    setCurrentProject(null);
  };

  // Loading state - show skeleton while data is loading
  const isLoading = profile === undefined;

  // Week days for summary
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const currentDayIndex = new Date().getDay();
  const adjustedDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;

  // Mock weekly hours data (replace with real data when available)
  const weeklyHours = [8.5, 7.0, 6.5, 0, 0, 0, 0];
  const todayHours = weeklyHours[adjustedDayIndex] + (currentTime / 3600);
  const totalWeekHours = weeklyHours.reduce((sum, h) => sum + h, 0) + (isClockedIn ? currentTime / 3600 : 0);

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
    },
    text: {
      color: colors.foreground,
    },
    mutedText: {
      color: colors.mutedForeground,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DashboardSkeleton colors={colors} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          {/* Welcome Header */}
          <View style={styles.header}>
            <Text style={[styles.greeting, dynamicStyles.mutedText]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.userName, dynamicStyles.text]}>
              {userName}
            </Text>
            <Text style={[styles.dateText, dynamicStyles.mutedText]}>
              {formatDutchDate(new Date())}
            </Text>
          </View>

          {/* Status Card */}
          <Card variant="elevated" style={styles.statusCard}>
            <CardHeader>
              <View style={styles.statusHeader}>
                <CardTitle>Werkstatus</CardTitle>
                <StatusBadge
                  status={isClockedIn ? 'active' : 'inactive'}
                  label={isClockedIn ? 'Ingeklokt' : 'Uitgeklokt'}
                />
              </View>
            </CardHeader>
            <CardContent>
              {isClockedIn ? (
                <>
                  {/* Timer display */}
                  <View style={styles.timerContainer}>
                    <Text style={[styles.timerLabel, dynamicStyles.mutedText]}>
                      Vandaag gewerkt
                    </Text>
                    <Text style={[styles.timerValue, dynamicStyles.text]}>
                      {formatTime(currentTime)}
                    </Text>
                  </View>

                  {/* Current project */}
                  {currentProject && (
                    <View style={[styles.projectInfo, { backgroundColor: colors.muted }]}>
                      <Feather name="folder" size={18} color={colors.scope.borders} />
                      <Text style={[styles.projectName, dynamicStyles.text]}>
                        {currentProject}
                      </Text>
                    </View>
                  )}

                  {/* Clock out button */}
                  <View style={styles.buttonContainer}>
                    <Button
                      onPress={handleClockOut}
                      title="Uitklokken"
                      variant="destructive"
                      icon={<Feather name="log-out" size={18} color={colors.destructiveForeground} />}
                      fullWidth
                    />
                  </View>
                </>
              ) : (
                <>
                  {/* Not clocked in state */}
                  <View style={styles.clockedOutContainer}>
                    <View style={[styles.clockIcon, { backgroundColor: colors.muted }]}>
                      <Feather name="clock" size={32} color={colors.mutedForeground} />
                    </View>
                    <Text style={[styles.clockedOutText, dynamicStyles.mutedText]}>
                      Start je werkdag om uren te registreren
                    </Text>
                  </View>

                  {/* Project selector placeholder */}
                  {activeProjects && activeProjects.length > 0 && (
                    <View style={[styles.projectSelector, { borderColor: colors.border }]}>
                      <Feather name="folder" size={18} color={colors.mutedForeground} />
                      <Text style={[styles.projectSelectorText, dynamicStyles.mutedText]}>
                        {activeProjects[0].naam}
                      </Text>
                      <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                    </View>
                  )}

                  {/* Clock in button */}
                  <View style={styles.buttonContainer}>
                    <Button
                      onPress={handleClockIn}
                      title="Inklokken"
                      variant="primary"
                      loading={isClockingIn}
                      icon={<Feather name="play" size={18} color={colors.primaryForeground} />}
                      fullWidth
                    />
                  </View>
                </>
              )}
            </CardContent>
          </Card>

          {/* Today's Stats */}
          <Card style={styles.statsCard}>
            <CardHeader>
              <CardTitle>Vandaag</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: `${colors.scope.borders}20` }]}>
                    <Feather name="clock" size={20} color={colors.scope.borders} />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={[styles.statLabel, dynamicStyles.mutedText]}>Uren</Text>
                    <AnimatedNumber
                      value={todayHours}
                      decimals={1}
                      suffix=" uur"
                      style={[styles.statValue, dynamicStyles.text]}
                    />
                  </View>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: `${colors.chart[1]}20` }]}>
                    <Feather name="briefcase" size={20} color={colors.chart[1]} />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={[styles.statLabel, dynamicStyles.mutedText]}>Projecten</Text>
                    <AnimatedNumber
                      value={projectStats?.in_uitvoering || 0}
                      style={[styles.statValue, dynamicStyles.text]}
                    />
                  </View>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, dynamicStyles.mutedText]}>
                    Voortgang vandaag
                  </Text>
                  <Text style={[styles.progressValue, dynamicStyles.mutedText]}>
                    {formatHoursMinutes(todayHours)} / 8:00
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.scope.borders,
                        width: `${Math.min(100, (todayHours / 8) * 100)}%`
                      }
                    ]}
                  />
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Week Summary */}
          <Card style={styles.weekCard}>
            <CardHeader>
              <View style={styles.weekHeader}>
                <CardTitle>Deze week</CardTitle>
                <View style={styles.weekTotal}>
                  <AnimatedNumber
                    value={totalWeekHours}
                    decimals={1}
                    style={[styles.weekTotalValue, dynamicStyles.text]}
                  />
                  <Text style={[styles.weekTotalLabel, dynamicStyles.mutedText]}> / 40 uur</Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View style={styles.weekGrid}>
                {weekDays.map((day, index) => {
                  const hours = index === adjustedDayIndex
                    ? todayHours
                    : weeklyHours[index];
                  const isToday = index === adjustedDayIndex;
                  const hasHours = hours > 0;

                  return (
                    <View
                      key={day}
                      style={[
                        styles.dayCard,
                        { backgroundColor: isToday ? colors.primary : colors.muted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          { color: isToday ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {day}
                      </Text>
                      <Text
                        style={[
                          styles.dayHours,
                          {
                            color: isToday
                              ? colors.primaryForeground
                              : hasHours
                                ? colors.foreground
                                : colors.mutedForeground
                          },
                        ]}
                      >
                        {formatHoursMinutes(hours)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </CardContent>
          </Card>

          {/* Active Projects */}
          {activeProjects && activeProjects.length > 0 && (
            <Card style={styles.projectsCard}>
              <CardHeader>
                <CardTitle>Actieve Projecten</CardTitle>
              </CardHeader>
              <CardContent>
                {activeProjects.slice(0, 3).map((project) => (
                  <TouchableOpacity
                    key={project._id}
                    style={[styles.projectRow, { borderBottomColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.projectRowContent}>
                      <View style={[styles.projectDot, { backgroundColor: colors.scope.borders }]} />
                      <View style={styles.projectRowInfo}>
                        <Text style={[styles.projectRowName, dynamicStyles.text]} numberOfLines={1}>
                          {project.naam}
                        </Text>
                        <Text style={[styles.projectRowMeta, dynamicStyles.mutedText]}>
                          {project.klantNaam}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.projectRowProgress}>
                      <Text style={[styles.projectRowHours, dynamicStyles.text]}>
                        {project.totaalUren}/{project.begroteUren}u
                      </Text>
                      <View style={[styles.miniProgressBar, { backgroundColor: colors.muted }]}>
                        <View
                          style={[
                            styles.miniProgressFill,
                            {
                              backgroundColor: project.voortgang > 100
                                ? colors.destructive
                                : colors.scope.borders,
                              width: `${Math.min(100, project.voortgang)}%`
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Financial Overview */}
          <Card style={styles.financialCard}>
            <CardHeader>
              <View style={styles.financialHeader}>
                <CardTitle>Financieel Overzicht</CardTitle>
                <View style={[styles.trendBadge, { backgroundColor: `${colors.chart[2]}20` }]}>
                  <Feather name="trending-up" size={12} color={colors.chart[2]} />
                  <Text style={[styles.trendText, { color: colors.chart[2] }]}>
                    {revenueStats?.conversionRate || 0}% conv.
                  </Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              {/* Revenue Card */}
              {(offerteStats === undefined || revenueStats === undefined) ? (
                <View style={styles.financialSkeletonContainer}>
                  <Skeleton width="100%" height={80} />
                  <View style={{ marginTop: spacing.md }}>
                    <Skeleton width="100%" height={120} />
                  </View>
                </View>
              ) : (
                <>
                  <View style={[styles.revenueCard, { backgroundColor: colors.muted }]}>
                    <View style={styles.revenueIconContainer}>
                      <View style={[styles.revenueIcon, { backgroundColor: `${colors.chart[2]}20` }]}>
                        <Feather name="dollar-sign" size={24} color={colors.chart[2]} />
                      </View>
                    </View>
                    <View style={styles.revenueContent}>
                      <Text style={[styles.revenueLabel, dynamicStyles.mutedText]}>
                        Totale omzet (geaccepteerd)
                      </Text>
                      <AnimatedNumber
                        value={revenueStats?.totalAcceptedValue || 0}
                        decimals={0}
                        prefix="\u20AC "
                        style={[styles.revenueValue, dynamicStyles.text]}
                      />
                      <Text style={[styles.revenueSubtext, dynamicStyles.mutedText]}>
                        {revenueStats?.totalAcceptedCount || 0} geaccepteerde offertes
                      </Text>
                    </View>
                  </View>

                  {/* Pipeline Summary */}
                  <View style={styles.pipelineSection}>
                    <Text style={[styles.pipelineSectionTitle, dynamicStyles.mutedText]}>
                      Offerte Pipeline
                    </Text>
                    <View style={styles.pipelineGrid}>
                      <View style={[styles.pipelineItem, { backgroundColor: colors.muted }]}>
                        <View style={[styles.pipelineIconContainer, { backgroundColor: `${colors.chart[3]}20` }]}>
                          <Feather name="edit-3" size={16} color={colors.chart[3]} />
                        </View>
                        <AnimatedNumber
                          value={offerteStats?.concept || 0}
                          decimals={0}
                          style={[styles.pipelineValue, dynamicStyles.text]}
                        />
                        <Text style={[styles.pipelineLabel, dynamicStyles.mutedText]}>Concept</Text>
                      </View>
                      <View style={[styles.pipelineItem, { backgroundColor: colors.muted }]}>
                        <View style={[styles.pipelineIconContainer, { backgroundColor: `${colors.chart[0]}20` }]}>
                          <Feather name="send" size={16} color={colors.chart[0]} />
                        </View>
                        <AnimatedNumber
                          value={offerteStats?.verzonden || 0}
                          decimals={0}
                          style={[styles.pipelineValue, dynamicStyles.text]}
                        />
                        <Text style={[styles.pipelineLabel, dynamicStyles.mutedText]}>Verzonden</Text>
                      </View>
                      <View style={[styles.pipelineItem, { backgroundColor: colors.muted }]}>
                        <View style={[styles.pipelineIconContainer, { backgroundColor: `${colors.chart[2]}20` }]}>
                          <Feather name="check-circle" size={16} color={colors.chart[2]} />
                        </View>
                        <AnimatedNumber
                          value={offerteStats?.geaccepteerd || 0}
                          decimals={0}
                          style={[styles.pipelineValue, dynamicStyles.text]}
                        />
                        <Text style={[styles.pipelineLabel, dynamicStyles.mutedText]}>Geaccepteerd</Text>
                      </View>
                    </View>
                  </View>

                  {/* Average Value */}
                  <View style={[styles.avgValueRow, { borderTopColor: colors.border }]}>
                    <View style={styles.avgValueItem}>
                      <Text style={[styles.avgValueLabel, dynamicStyles.mutedText]}>
                        Gem. offerte waarde
                      </Text>
                      <Text style={[styles.avgValueText, dynamicStyles.text]}>
                        {formatCurrency(revenueStats?.averageOfferteValue || 0)}
                      </Text>
                    </View>
                    <View style={styles.avgValueItem}>
                      <Text style={[styles.avgValueLabel, dynamicStyles.mutedText]}>
                        Totale waarde
                      </Text>
                      <Text style={[styles.avgValueText, dynamicStyles.text]}>
                        {formatCurrency(offerteStats?.totaalWaarde || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Quick Action Button */}
                  <View style={styles.quickActionContainer}>
                    <Button
                      onPress={() => {
                        // TODO: Navigate to offerte creation when available in mobile app
                        // For now, this could open a link to the web app
                      }}
                      title="Nieuwe offerte"
                      variant="outline"
                      icon={<Feather name="plus" size={18} color={colors.primary} />}
                      fullWidth
                    />
                  </View>
                </>
              )}
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Header
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
  },
  userName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },

  // Status Card
  statusCard: {
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  timerValue: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  projectName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  buttonContainer: {
    marginTop: spacing.sm,
  },
  clockedOutContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  clockIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  clockedOutText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  projectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  projectSelectorText: {
    flex: 1,
    fontSize: typography.fontSize.base,
  },

  // Stats Card
  statsCard: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  progressContainer: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
  },
  progressValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressBar: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Week Card
  weekCard: {
    marginBottom: spacing.md,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  weekTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  weekTotalLabel: {
    fontSize: typography.fontSize.sm,
  },
  weekGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  dayLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  dayHours: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Projects Card
  projectsCard: {
    marginBottom: spacing.md,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  projectRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  projectDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  projectRowInfo: {
    flex: 1,
  },
  projectRowName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  projectRowMeta: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  projectRowProgress: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  projectRowHours: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  miniProgressBar: {
    width: 60,
    height: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Financial Card
  financialCard: {
    marginBottom: spacing.md,
  },
  financialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  trendText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  financialSkeletonContainer: {
    gap: spacing.md,
  },
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  revenueIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueContent: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  revenueValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  revenueSubtext: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  pipelineSection: {
    marginBottom: spacing.md,
  },
  pipelineSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.md,
  },
  pipelineGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pipelineItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  pipelineIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pipelineValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  pipelineLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  avgValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    marginBottom: spacing.md,
  },
  avgValueItem: {
    flex: 1,
    alignItems: 'center',
  },
  avgValueLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  avgValueText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  quickActionContainer: {
    marginTop: spacing.sm,
  },
});
