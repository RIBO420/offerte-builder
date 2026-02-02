import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole } from '../../hooks/use-user-role';
import { cn } from '@/lib/utils';

// Theme system
import { useColors, useTheme } from '../../theme';

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
  Badge,
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
    <View className="p-4 pb-10">
      {/* Header skeleton */}
      <View className="mb-6">
        <Skeleton width={120} height={18} />
        <View className="mt-1">
          <Skeleton width={180} height={28} />
        </View>
        <View className="mt-1">
          <Skeleton width={200} height={14} />
        </View>
      </View>

      {/* Status card skeleton */}
      <SkeletonCard lines={4} />

      {/* Stats skeleton */}
      <View className="mt-6">
        <SkeletonCard lines={2} />
      </View>

      {/* Week summary skeleton */}
      <View className="mt-6">
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
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
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
  const { isAdmin, isMedewerker, roleDisplayName } = useUserRole();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const profile = useQuery(api.medewerkers.getActive);
  const projectStats = useQuery(api.projecten.getStats);
  const activeProjects = useQuery(api.projecten.getActiveProjectsWithProgress);

  // Planning query - only for medewerkers
  const planningProjects = useQuery(
    api.projecten.listForPlanning,
    isMedewerker ? {} : 'skip'
  );

  // Financial queries - only for admins
  const offerteStats = useQuery(
    api.offertes.getStats,
    isAdmin ? {} : 'skip'
  );
  const revenueStats = useQuery(
    api.offertes.getRevenueStats,
    isAdmin ? {} : 'skip'
  );

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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <DashboardSkeleton colors={colors} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="p-4 pb-10">
          {/* Welcome Header */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center">
              <Text className="text-base font-normal text-muted-foreground">
                {getGreeting()},
              </Text>
              <Badge
                variant={isAdmin ? 'default' : 'secondary'}
                size="sm"
              >
                {roleDisplayName}
              </Badge>
            </View>
            <Text className="text-2xl font-bold mt-1 text-foreground">
              {userName}
            </Text>
            <Text className="text-sm mt-1 text-muted-foreground">
              {formatDutchDate(new Date())}
            </Text>
          </View>

          {/* Status Card */}
          <Card variant="elevated" className="mb-4">
            <CardHeader>
              <View className="flex-row justify-between items-center">
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
                  <View className="items-center mb-4">
                    <Text className="text-sm mb-1 text-muted-foreground">
                      Vandaag gewerkt
                    </Text>
                    <Text className="text-4xl font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatTime(currentTime)}
                    </Text>
                  </View>

                  {/* Current project */}
                  {currentProject && (
                    <View className="flex-row items-center gap-2 p-4 rounded-lg mb-4 bg-muted">
                      <Feather name="folder" size={18} color={colors.scope.borders} />
                      <Text className="text-base font-medium text-foreground">
                        {currentProject}
                      </Text>
                    </View>
                  )}

                  {/* Clock out button */}
                  <View className="mt-2">
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
                  <View className="items-center py-6">
                    <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-muted">
                      <Feather name="clock" size={32} color={colors.mutedForeground} />
                    </View>
                    <Text className="text-sm text-center mb-4 text-muted-foreground">
                      Start je werkdag om uren te registreren
                    </Text>
                  </View>

                  {/* Project selector placeholder */}
                  {activeProjects && activeProjects.length > 0 && (
                    <View className="flex-row items-center gap-2 p-4 border rounded-lg mb-4 border-border">
                      <Feather name="folder" size={18} color={colors.mutedForeground} />
                      <Text className="flex-1 text-base text-muted-foreground">
                        {activeProjects[0].naam}
                      </Text>
                      <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                    </View>
                  )}

                  {/* Clock in button */}
                  <View className="mt-2">
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
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Vandaag</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1 flex-row items-center gap-4">
                  <View className="w-11 h-11 rounded-lg items-center justify-center" style={{ backgroundColor: `${colors.scope.borders}20` }}>
                    <Feather name="clock" size={20} color={colors.scope.borders} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm mb-0.5 text-muted-foreground">Uren</Text>
                    <AnimatedNumber
                      value={todayHours}
                      decimals={1}
                      suffix=" uur"
                      className="text-lg font-semibold text-foreground"
                    />
                  </View>
                </View>

                <View className="flex-1 flex-row items-center gap-4">
                  <View className="w-11 h-11 rounded-lg items-center justify-center" style={{ backgroundColor: `${colors.chart[1]}20` }}>
                    <Feather name="briefcase" size={20} color={colors.chart[1]} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm mb-0.5 text-muted-foreground">Projecten</Text>
                    <AnimatedNumber
                      value={projectStats?.in_uitvoering || 0}
                      className="text-lg font-semibold text-foreground"
                    />
                  </View>
                </View>
              </View>

              {/* Progress bar */}
              <View className="gap-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-muted-foreground">
                    Voortgang vandaag
                  </Text>
                  <Text className="text-sm font-medium text-muted-foreground">
                    {formatHoursMinutes(todayHours)} / 8:00
                  </Text>
                </View>
                <View className="h-2 rounded-full overflow-hidden bg-muted">
                  <View
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: colors.scope.borders,
                      width: `${Math.min(100, (todayHours / 8) * 100)}%`
                    }}
                  />
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Week Summary */}
          <Card className="mb-4">
            <CardHeader>
              <View className="flex-row justify-between items-center">
                <CardTitle>Deze week</CardTitle>
                <View className="flex-row items-baseline">
                  <AnimatedNumber
                    value={totalWeekHours}
                    decimals={1}
                    className="text-lg font-semibold text-foreground"
                  />
                  <Text className="text-sm text-muted-foreground"> / 40 uur</Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View className="flex-row gap-2">
                {weekDays.map((day, index) => {
                  const hours = index === adjustedDayIndex
                    ? todayHours
                    : weeklyHours[index];
                  const isToday = index === adjustedDayIndex;
                  const hasHours = hours > 0;

                  return (
                    <View
                      key={day}
                      className={cn(
                        "flex-1 items-center py-4 rounded-lg",
                        isToday ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-xs font-medium mb-1",
                          isToday ? "text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {day}
                      </Text>
                      <Text
                        className={cn(
                          "text-sm font-semibold",
                          isToday
                            ? "text-primary-foreground"
                            : hasHours
                              ? "text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {formatHoursMinutes(hours)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </CardContent>
          </Card>

          {/* Mijn Planning - Medewerker Only */}
          {isMedewerker && (
            <Card className="mb-4">
              <CardHeader>
                <View className="flex-row items-center gap-2">
                  <Feather name="calendar" size={20} color={colors.primary} />
                  <CardTitle>Mijn Planning</CardTitle>
                </View>
              </CardHeader>
              <CardContent>
                {planningProjects === undefined ? (
                  <View className="py-4">
                    <Skeleton width="100%" height={60} />
                  </View>
                ) : planningProjects.length === 0 ? (
                  <View className="items-center py-6">
                    <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-muted">
                      <Feather name="calendar" size={32} color={colors.mutedForeground} />
                    </View>
                    <Text className="text-sm text-center text-muted-foreground">
                      Geen projecten toegewezen
                    </Text>
                  </View>
                ) : (
                  planningProjects.slice(0, 5).map((project, index) => (
                    <TouchableOpacity
                      key={project._id}
                      className={cn(
                        "py-4",
                        index < planningProjects.length - 1 && index < 4 && "border-b border-border"
                      )}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1">
                          <Text className="text-base font-medium text-foreground" numberOfLines={1}>
                            {project.naam}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-1">
                            <StatusBadge
                              status={project.status === "gepland" ? "warning" : project.status === "in_uitvoering" ? "active" : "default"}
                              label={project.status === "gepland" ? "Gepland" : project.status === "in_uitvoering" ? "In uitvoering" : "Afgerond"}
                              size="sm"
                            />
                            {project.geschatteDagen > 0 && (
                              <Text className="text-xs text-muted-foreground">
                                {project.geschatteDagen} {project.geschatteDagen === 1 ? 'dag' : 'dagen'}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      {project.teamleden && project.teamleden.length > 0 && (
                        <View className="flex-row items-center gap-2 mt-2">
                          <Feather name="users" size={14} color={colors.mutedForeground} />
                          <Text className="text-xs text-muted-foreground">
                            {project.teamleden.join(', ')}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Active Projects */}
          {activeProjects && activeProjects.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Actieve Projecten</CardTitle>
              </CardHeader>
              <CardContent>
                {activeProjects.slice(0, 3).map((project) => (
                  <TouchableOpacity
                    key={project._id}
                    className="flex-row items-center justify-between py-4 border-b border-border"
                    activeOpacity={0.7}
                  >
                    <View className="flex-1 flex-row items-center gap-4">
                      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.scope.borders }} />
                      <View className="flex-1">
                        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
                          {project.naam}
                        </Text>
                        <Text className="text-sm mt-0.5 text-muted-foreground">
                          {project.klantNaam}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-sm font-medium text-foreground">
                        {project.totaalUren}/{project.begroteUren}u
                      </Text>
                      <View className="w-15 h-1 rounded-full overflow-hidden bg-muted">
                        <View
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: project.voortgang > 100
                              ? colors.destructive
                              : colors.scope.borders,
                            width: `${Math.min(100, project.voortgang)}%`
                          }}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Financial Overview - Admin Only */}
          {isAdmin && (
            <Card className="mb-4">
              <CardHeader>
                <View className="flex-row justify-between items-center">
                  <CardTitle>Financieel Overzicht</CardTitle>
                  <View className="flex-row items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: `${colors.chart[2]}20` }}>
                    <Feather name="trending-up" size={12} color={colors.chart[2]} />
                    <Text className="text-xs font-medium" style={{ color: colors.chart[2] }}>
                      {revenueStats?.conversionRate || 0}% conv.
                    </Text>
                  </View>
                </View>
              </CardHeader>
              <CardContent>
                {/* Revenue Card */}
                {(offerteStats === undefined || revenueStats === undefined) ? (
                  <View className="gap-4">
                    <Skeleton width="100%" height={80} />
                    <View className="mt-4">
                      <Skeleton width="100%" height={120} />
                    </View>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center gap-4 p-4 rounded-lg mb-6 bg-muted">
                      <View className="items-center justify-center">
                        <View className="w-12 h-12 rounded-lg items-center justify-center" style={{ backgroundColor: `${colors.chart[2]}20` }}>
                          <Feather name="dollar-sign" size={24} color={colors.chart[2]} />
                        </View>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm mb-1 text-muted-foreground">
                          Totale omzet (geaccepteerd)
                        </Text>
                        <AnimatedNumber
                          value={revenueStats?.totalAcceptedValue || 0}
                          decimals={0}
                          prefix="\u20AC "
                          className="text-2xl font-bold text-foreground"
                        />
                        <Text className="text-xs mt-1 text-muted-foreground">
                          {revenueStats?.totalAcceptedCount || 0} geaccepteerde offertes
                        </Text>
                      </View>
                    </View>

                    {/* Pipeline Summary */}
                    <View className="mb-4">
                      <Text className="text-sm font-medium mb-4 text-muted-foreground">
                        Offerte Pipeline
                      </Text>
                      <View className="flex-row gap-2">
                        <View className="flex-1 items-center py-4 px-2 rounded-lg bg-muted">
                          <View className="w-8 h-8 rounded-md items-center justify-center mb-2" style={{ backgroundColor: `${colors.chart[3]}20` }}>
                            <Feather name="edit-3" size={16} color={colors.chart[3]} />
                          </View>
                          <AnimatedNumber
                            value={offerteStats?.concept || 0}
                            decimals={0}
                            className="text-xl font-bold mb-0.5 text-foreground"
                          />
                          <Text className="text-xs text-center text-muted-foreground">Concept</Text>
                        </View>
                        <View className="flex-1 items-center py-4 px-2 rounded-lg bg-muted">
                          <View className="w-8 h-8 rounded-md items-center justify-center mb-2" style={{ backgroundColor: `${colors.chart[0]}20` }}>
                            <Feather name="send" size={16} color={colors.chart[0]} />
                          </View>
                          <AnimatedNumber
                            value={offerteStats?.verzonden || 0}
                            decimals={0}
                            className="text-xl font-bold mb-0.5 text-foreground"
                          />
                          <Text className="text-xs text-center text-muted-foreground">Verzonden</Text>
                        </View>
                        <View className="flex-1 items-center py-4 px-2 rounded-lg bg-muted">
                          <View className="w-8 h-8 rounded-md items-center justify-center mb-2" style={{ backgroundColor: `${colors.chart[2]}20` }}>
                            <Feather name="check-circle" size={16} color={colors.chart[2]} />
                          </View>
                          <AnimatedNumber
                            value={offerteStats?.geaccepteerd || 0}
                            decimals={0}
                            className="text-xl font-bold mb-0.5 text-foreground"
                          />
                          <Text className="text-xs text-center text-muted-foreground">Geaccepteerd</Text>
                        </View>
                      </View>
                    </View>

                    {/* Average Value */}
                    <View className="flex-row justify-between pt-4 border-t mb-4 border-border">
                      <View className="flex-1 items-center">
                        <Text className="text-xs mb-1 text-center text-muted-foreground">
                          Gem. offerte waarde
                        </Text>
                        <Text className="text-base font-semibold text-foreground">
                          {formatCurrency(revenueStats?.averageOfferteValue || 0)}
                        </Text>
                      </View>
                      <View className="flex-1 items-center">
                        <Text className="text-xs mb-1 text-center text-muted-foreground">
                          Totale waarde
                        </Text>
                        <Text className="text-base font-semibold text-foreground">
                          {formatCurrency(offerteStats?.totaalWaarde || 0)}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Action Button */}
                    <View className="mt-2">
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
          )}

          {/* Medewerker Summary Card - Only for non-admin users */}
          {isMedewerker && (
            <Card className="mb-4">
              <CardHeader>
                <View className="flex-row justify-between items-center">
                  <CardTitle>Mijn Overzicht</CardTitle>
                  <Badge variant="secondary" size="sm">
                    {roleDisplayName}
                  </Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View className="p-4 rounded-lg bg-muted">
                  <View className="flex-row items-center gap-4">
                    <View className="w-11 h-11 rounded-lg items-center justify-center" style={{ backgroundColor: `${colors.scope.borders}20` }}>
                      <Feather name="calendar" size={20} color={colors.scope.borders} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm mb-0.5 text-muted-foreground">
                        Toegewezen projecten
                      </Text>
                      <Text className="text-lg font-semibold text-foreground">
                        {activeProjects?.length || 0} actief
                      </Text>
                    </View>
                  </View>
                  <View className="h-px my-4 bg-border" />
                  <View className="flex-row items-center gap-4">
                    <View className="w-11 h-11 rounded-lg items-center justify-center" style={{ backgroundColor: `${colors.chart[1]}20` }}>
                      <Feather name="clock" size={20} color={colors.chart[1]} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm mb-0.5 text-muted-foreground">
                        Deze week gewerkt
                      </Text>
                      <Text className="text-lg font-semibold text-foreground">
                        {formatHoursMinutes(totalWeekHours)} uur
                      </Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
