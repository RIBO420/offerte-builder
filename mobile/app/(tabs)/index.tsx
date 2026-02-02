import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole } from '../../hooks/use-user-role';
import { cn } from '@/lib/utils';

// Theme system
import { useColors } from '../../theme';

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

// Wrapper component that handles auth check
export default function DashboardScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  if (isLoading || !isUserSynced) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-1 justify-center items-center">
            <Skeleton width={200} height={24} className="mb-4" />
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
  const planningProjects = useQuery(
    api.projecten.listForPlanning,
    isMedewerker ? {} : 'skip'
  );
  const offerteStats = useQuery(api.offertes.getStats, isAdmin ? {} : 'skip');
  const revenueStats = useQuery(api.offertes.getRevenueStats, isAdmin ? {} : 'skip');

  const userName = profile?.[0]?.naam || 'Medewerker';

  // Mock session state
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isClockedIn && sessionStartTime) {
      interval = setInterval(() => {
        setCurrentTime(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
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

  if (profile === undefined) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-1 justify-center items-center">
            <Skeleton width={200} height={24} className="mb-4" />
            <Skeleton width={150} height={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View className="px-4 pt-2">
            {/* Compact Header */}
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-sm text-muted-foreground">{getGreeting()},</Text>
                <Text className="text-lg font-bold text-foreground">{userName}</Text>
              </View>
              <StatusBadge
                status={isClockedIn ? 'active' : 'inactive'}
                label={isClockedIn ? 'Ingeklokt' : 'Uitgeklokt'}
              />
            </View>

            {/* Timer Card - Compact */}
            <Card variant="glass" className="mb-2 p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className={cn(
                    "w-12 h-12 rounded-xl items-center justify-center",
                    isClockedIn ? "bg-green-500/20" : "bg-muted"
                  )}>
                    <Feather
                      name={isClockedIn ? "play-circle" : "clock"}
                      size={24}
                      color={isClockedIn ? colors.success : colors.mutedForeground}
                    />
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground">
                      {isClockedIn ? 'Vandaag' : 'Start je dag'}
                    </Text>
                    <Text className="text-2xl font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatTime(isClockedIn ? currentTime : Math.floor(todayHours * 3600))}
                    </Text>
                  </View>
                </View>
                <Button
                  onPress={isClockedIn ? handleClockOut : handleClockIn}
                  title={isClockedIn ? "Stop" : "Start"}
                  variant={isClockedIn ? "destructive" : "primary"}
                  loading={isClockingIn}
                  size="sm"
                  icon={<Feather name={isClockedIn ? "square" : "play"} size={16} color="#fff" />}
                />
              </View>
            </Card>

            {/* Week Summary - Compact horizontal */}
            <Card variant="glass" className="mb-2 p-3">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-medium text-foreground">Deze week</Text>
                <Text className="text-sm text-muted-foreground">
                  <Text className="font-semibold text-foreground">{formatHoursMinutes(totalWeekHours)}</Text> / 40u
                </Text>
              </View>
              <View className="flex-row gap-1">
                {weekDays.map((day, index) => {
                  const hours = index === adjustedDayIndex ? todayHours : weeklyHours[index];
                  const isToday = index === adjustedDayIndex;
                  return (
                    <View
                      key={day}
                      className={cn(
                        "flex-1 items-center py-2 rounded-lg",
                        isToday ? "bg-primary" : "bg-muted/50"
                      )}
                    >
                      <Text className={cn(
                        "text-[10px] font-medium",
                        isToday ? "text-primary-foreground" : "text-muted-foreground"
                      )}>{day}</Text>
                      <Text className={cn(
                        "text-xs font-semibold",
                        isToday ? "text-primary-foreground" : hours > 0 ? "text-foreground" : "text-muted-foreground/50"
                      )}>{hours > 0 ? formatHoursMinutes(hours) : '-'}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Medewerker: Planning Projects */}
            {isMedewerker && planningProjects && planningProjects.length > 0 && (
              <Card variant="glass" className="mb-2 p-3">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2">
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text className="text-sm font-medium text-foreground">Mijn Projecten</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{planningProjects.length} toegewezen</Text>
                </View>
                {planningProjects.slice(0, 3).map((project, index) => (
                  <TouchableOpacity
                    key={project._id}
                    className={cn(
                      "flex-row items-center justify-between py-2",
                      index < Math.min(planningProjects.length, 3) - 1 && "border-b border-border/50"
                    )}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/project/${project._id}`)}
                  >
                    <View className="flex-1 flex-row items-center gap-2">
                      <View className="w-2 h-2 rounded-full bg-primary" />
                      <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{project.naam}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <StatusBadge
                        status={project.status === "gepland" ? "warning" : project.status === "in_uitvoering" ? "active" : "default"}
                        label={project.status === "gepland" ? "Gepland" : project.status === "in_uitvoering" ? "Actief" : "Klaar"}
                        size="sm"
                      />
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* Medewerker: Quick Stats */}
            {isMedewerker && (
              <View className="flex-row gap-2 mb-2">
                <Card variant="glass" className="flex-1 p-3">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-lg items-center justify-center bg-primary/20">
                      <Feather name="briefcase" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground">Actief</Text>
                      <Text className="text-lg font-bold text-foreground">{projectStats?.in_uitvoering || 0}</Text>
                    </View>
                  </View>
                </Card>
                <Card variant="glass" className="flex-1 p-3">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-lg items-center justify-center bg-amber-500/20">
                      <Feather name="clock" size={16} color="#f59e0b" />
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground">Week</Text>
                      <Text className="text-lg font-bold text-foreground">{formatHoursMinutes(totalWeekHours)}</Text>
                    </View>
                  </View>
                </Card>
              </View>
            )}

            {/* Admin: Financial Overview - Compact */}
            {isAdmin && (
              <>
                <Card variant="glass" className="mb-2 p-3">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-medium text-foreground">Financieel</Text>
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20">
                      <Feather name="trending-up" size={10} color={colors.success} />
                      <Text className="text-[10px] font-medium text-green-500">
                        {revenueStats?.conversionRate || 0}%
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-3 mb-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center bg-green-500/20">
                      <Feather name="dollar-sign" size={20} color={colors.success} />
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground">Omzet</Text>
                      <AnimatedNumber
                        value={revenueStats?.totalAcceptedValue || 0}
                        decimals={0}
                        prefix="€"
                        className="text-xl font-bold text-foreground"
                      />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1 items-center py-2 rounded-lg bg-muted/50">
                      <Text className="text-lg font-bold text-foreground">{offerteStats?.concept || 0}</Text>
                      <Text className="text-[10px] text-muted-foreground">Concept</Text>
                    </View>
                    <View className="flex-1 items-center py-2 rounded-lg bg-muted/50">
                      <Text className="text-lg font-bold text-foreground">{offerteStats?.verzonden || 0}</Text>
                      <Text className="text-[10px] text-muted-foreground">Verzonden</Text>
                    </View>
                    <View className="flex-1 items-center py-2 rounded-lg bg-muted/50">
                      <Text className="text-lg font-bold text-foreground">{offerteStats?.geaccepteerd || 0}</Text>
                      <Text className="text-[10px] text-muted-foreground">Geaccepteerd</Text>
                    </View>
                  </View>
                </Card>

                {/* Admin: Active Projects */}
                {activeProjects && activeProjects.length > 0 && (
                  <Card variant="glass" className="mb-2 p-3">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm font-medium text-foreground">Actieve Projecten</Text>
                      <Text className="text-xs text-muted-foreground">{activeProjects.length} totaal</Text>
                    </View>
                    {activeProjects.slice(0, 3).map((project, index) => (
                      <TouchableOpacity
                        key={project._id}
                        className={cn(
                          "flex-row items-center justify-between py-2",
                          index < Math.min(activeProjects.length, 3) - 1 && "border-b border-border/50"
                        )}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/project/${project._id}`)}
                      >
                        <View className="flex-1">
                          <Text className="text-sm text-foreground" numberOfLines={1}>{project.naam}</Text>
                          <Text className="text-xs text-muted-foreground">{project.klantNaam}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs font-medium text-foreground">
                            {project.totaalUren}/{project.begroteUren}u
                          </Text>
                          <View className="w-12 h-1 rounded-full overflow-hidden bg-muted mt-1">
                            <View
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: project.voortgang > 100 ? colors.destructive : colors.success,
                                width: `${Math.min(100, project.voortgang)}%`
                              }}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </Card>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
