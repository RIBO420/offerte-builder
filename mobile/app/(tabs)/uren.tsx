import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useColors } from '../../theme';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  Button,
  Tabs,
  TabsContent,
  Badge,
  AnimatedNumber,
  Input,
} from '../../components/ui';

// Scope options for time registration
const SCOPE_OPTIONS = [
  { key: 'grondwerk', label: 'Grondwerk' },
  { key: 'bestrating', label: 'Bestrating' },
  { key: 'borders', label: 'Borders' },
  { key: 'gras', label: 'Gras' },
  { key: 'houtwerk', label: 'Houtwerk' },
  { key: 'water', label: 'Water' },
  { key: 'specials', label: 'Specials' },
];

// Quick hour buttons
const QUICK_HOURS = [4, 6, 7.5, 8];

// Helper to get last N days as date options
function getDateOptions(days: number): { key: string; label: string }[] {
  const options: { key: string; label: string }[] = [];
  const today = new Date();
  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = dayNames[date.getDay()];
    const label = i === 0
      ? 'Vandaag'
      : i === 1
        ? 'Gisteren'
        : `${dayName} ${date.getDate()}/${date.getMonth() + 1}`;
    options.push({ key: dateStr, label });
  }
  return options;
}

type TabType = 'dag' | 'week';

// Project type for local state
interface SelectedProject {
  _id: string;
  naam: string;
  klantNaam: string;
}

// Helper function to format time as HH:MM:SS
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to format hours as HH:MM
function formatHoursMinutes(hours: number): string {
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

// Helper to get the start of the current week (Monday)
function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split('T')[0];
}

// Wrapper component that handles auth check
export default function UrenScreen() {
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

  return <AuthenticatedUrenScreen />;
}

// Separate component that only renders when authenticated
function AuthenticatedUrenScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>('dag');
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);

  // Manual entry modal state
  const [manualEntryModalVisible, setManualEntryModalVisible] = useState(false);
  const [manualEntryDate, setManualEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualEntryProject, setManualEntryProject] = useState<SelectedProject | null>(null);
  const [manualEntryHours, setManualEntryHours] = useState<string>('');
  const [manualEntryScope, setManualEntryScope] = useState<string>('');
  const [manualEntryNotes, setManualEntryNotes] = useState<string>('');
  const [isSubmittingManualEntry, setIsSubmittingManualEntry] = useState(false);
  const [manualEntryProjectSelectorVisible, setManualEntryProjectSelectorVisible] = useState(false);

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const activeSession = useQuery(api.mobile.getActiveSession);
  const todayHours = useQuery(api.mobile.getTodayHours);
  const weekHours = useQuery(api.mobile.getWeekHours, { weekStart: getWeekStart() });
  const assignedProjects = useQuery(api.mobile.getAssignedProjects);

  // Convex mutations
  const clockInMutation = useMutation(api.mobile.clockIn);
  const clockOutMutation = useMutation(api.mobile.clockOut);
  const startBreakMutation = useMutation(api.mobile.startBreak);
  const endBreakMutation = useMutation(api.mobile.endBreak);
  const syncUrenMutation = useMutation(api.mobile.syncUrenRegistraties);

  // Loading and clocking states
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [isPauseToggling, setIsPauseToggling] = useState(false);

  // Calculate whether user is clocked in
  const isClockedIn = activeSession !== null && activeSession !== undefined;
  const isOnBreak = activeSession?.status === 'break';

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isClockedIn && !isOnBreak && activeSession?.clockInAt) {
      // Calculate initial elapsed time
      const now = Date.now();
      const clockInTime = activeSession.clockInAt;
      const initialSeconds = Math.floor((now - clockInTime) / 1000);
      setElapsedSeconds(initialSeconds);

      // Update every second
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (!isClockedIn) {
      setElapsedSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClockedIn, isOnBreak, activeSession?.clockInAt]);

  // Handlers
  const handleClockIn = async () => {
    if (!selectedProject) {
      setProjectModalVisible(true);
      return;
    }

    try {
      setIsClockingIn(true);
      // Cast to any to work around mobile convex type generation
      await clockInMutation({ projectId: selectedProject._id as any });
    } catch (error) {
      console.error('Clock in error:', error);
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setIsClockingOut(true);
      await clockOutMutation({});
      setSelectedProject(null);
    } catch (error) {
      console.error('Clock out error:', error);
    } finally {
      setIsClockingOut(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      setIsPauseToggling(true);
      if (isOnBreak) {
        await endBreakMutation({});
      } else {
        await startBreakMutation({});
      }
    } catch (error) {
      console.error('Pause toggle error:', error);
    } finally {
      setIsPauseToggling(false);
    }
  };

  const handleSelectProject = (project: SelectedProject | null) => {
    setSelectedProject(project);
    setProjectModalVisible(false);
    // Auto clock-in after selecting project
    if (project && !isClockedIn) {
      // Cast to any to work around mobile convex type generation
      clockInMutation({ projectId: project._id as any })
        .then(() => {})
        .catch((error) => console.error('Auto clock-in error:', error));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Queries will automatically refresh
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Manual entry handlers
  const resetManualEntryForm = useCallback(() => {
    setManualEntryDate(new Date().toISOString().split('T')[0]);
    setManualEntryProject(null);
    setManualEntryHours('');
    setManualEntryScope('');
    setManualEntryNotes('');
  }, []);

  const handleOpenManualEntry = useCallback(() => {
    resetManualEntryForm();
    setManualEntryModalVisible(true);
  }, [resetManualEntryForm]);

  const handleCloseManualEntry = useCallback(() => {
    setManualEntryModalVisible(false);
    resetManualEntryForm();
  }, [resetManualEntryForm]);

  const handleSubmitManualEntry = useCallback(async () => {
    // Validate required fields
    if (!manualEntryProject) {
      Alert.alert('Fout', 'Selecteer een project');
      return;
    }

    const hours = parseFloat(manualEntryHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Fout', 'Voer een geldig aantal uren in (0-24)');
      return;
    }

    if (!manualEntryDate) {
      Alert.alert('Fout', 'Selecteer een datum');
      return;
    }

    try {
      setIsSubmittingManualEntry(true);

      // Create a unique idempotency key
      const idempotencyKey = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Use syncUrenRegistraties to add the entry
      const results = await syncUrenMutation({
        entries: [
          {
            idempotencyKey,
            projectId: manualEntryProject._id as any,
            datum: manualEntryDate,
            uren: hours,
            notities: manualEntryScope
              ? `[${manualEntryScope}] ${manualEntryNotes || ''}`.trim()
              : manualEntryNotes || undefined,
            clientTimestamp: Date.now(),
          },
        ],
      });

      // Check result
      const result = results[0];
      if (result?.status === 'synced') {
        Alert.alert('Succes', 'Uren zijn toegevoegd', [
          { text: 'OK', onPress: handleCloseManualEntry },
        ]);
      } else if (result?.status === 'duplicate') {
        Alert.alert('Let op', 'Deze registratie bestaat al');
      } else {
        Alert.alert('Fout', result?.error || 'Er is iets misgegaan');
      }
    } catch (error) {
      console.error('Manual entry error:', error);
      Alert.alert('Fout', 'Er is iets misgegaan bij het opslaan');
    } finally {
      setIsSubmittingManualEntry(false);
    }
  }, [
    manualEntryProject,
    manualEntryHours,
    manualEntryDate,
    manualEntryScope,
    manualEntryNotes,
    syncUrenMutation,
    handleCloseManualEntry,
  ]);

  const handleSelectManualEntryProject = useCallback((project: SelectedProject | null) => {
    setManualEntryProject(project);
    setManualEntryProjectSelectorVisible(false);
  }, []);

  // Date options for manual entry (last 7 days)
  const dateOptions = useMemo(() => getDateOptions(7), []);

  // Week days for grid
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const currentDayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday-based index
  }, []);

  // Tab configuration
  const tabs = [
    { key: 'dag', label: 'Dag' },
    { key: 'week', label: 'Week' },
  ];

  // Loading state - show loading while data is loading
  if (activeSession === undefined || todayHours === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 justify-center items-center p-6">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-base text-muted-foreground font-medium">
            Laden...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Tabs */}
      <View className="bg-card py-2 border-b border-border">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as TabType)}
          variant="default"
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Timer Card */}
        <View className="bg-card rounded-2xl p-4 items-center mx-4 mt-4 border border-border shadow-sm">
          <Text className="text-sm text-muted-foreground mb-1">
            {isClockedIn ? 'Huidige sessie' : 'Vandaag gewerkt'}
          </Text>
          <Text className="text-4xl font-bold text-foreground tabular-nums">
            {isClockedIn
              ? formatTime(elapsedSeconds)
              : formatTime(Math.floor((todayHours?.totalHours || 0) * 3600))}
          </Text>

          <View className="flex-row items-center gap-2 mt-2 mb-4">
            <View
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                isClockedIn
                  ? isOnBreak
                    ? "bg-amber-500"
                    : "bg-green-500"
                  : "bg-muted-foreground"
              )}
            />
            <Text className="text-sm text-muted-foreground">
              {isClockedIn
                ? isOnBreak
                  ? 'Op pauze'
                  : 'Ingeklokt'
                : 'Niet ingeklokt'}
            </Text>
          </View>

          {/* Project Selector */}
          <TouchableOpacity
            className="flex-row items-center justify-between bg-secondary rounded-lg p-3 mt-4 w-full border border-border"
            onPress={() => setProjectModalVisible(true)}
            disabled={isClockedIn}
          >
            <Text
              className={cn(
                "text-sm font-medium flex-1",
                selectedProject ? "text-foreground" : "text-muted-foreground"
              )}
              numberOfLines={1}
            >
              {selectedProject ? selectedProject.naam : 'Selecteer een project'}
            </Text>
            <Feather
              name="chevron-down"
              size={20}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View className="flex-row gap-2 w-full mt-4">
            {!isClockedIn ? (
              <Button
                title="Inklokken"
                onPress={handleClockIn}
                loading={isClockingIn}
                fullWidth
                icon={
                  <Feather
                    name="play"
                    size={18}
                    color={colors.primaryForeground}
                  />
                }
              />
            ) : (
              <>
                <View className="flex-1">
                  <Button
                    title={isOnBreak ? 'Verder' : 'Pauze'}
                    onPress={handleTogglePause}
                    loading={isPauseToggling}
                    variant="secondary"
                    fullWidth
                    icon={
                      <Feather
                        name={isOnBreak ? 'play' : 'pause'}
                        size={18}
                        color={colors.secondaryForeground}
                      />
                    }
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title="Uitklokken"
                    onPress={handleClockOut}
                    loading={isClockingOut}
                    variant="destructive"
                    fullWidth
                    icon={
                      <Feather
                        name="square"
                        size={18}
                        color={colors.destructiveForeground}
                      />
                    }
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Tab Content */}
        <TabsContent tabKey="dag" activeTab={activeTab}>
          {/* Week Overview Grid */}
          <View className="mt-6 px-4">
            <Text className="text-lg font-semibold text-foreground mb-4">Week Overzicht</Text>
            <View className="flex-row gap-1">
              {weekDays.map((day, index) => {
                const dayData = weekHours?.dailyHours?.[index];
                const hoursForDay = dayData?.uren || 0;

                return (
                  <View
                    key={day}
                    className={cn(
                      "flex-1 bg-card rounded-lg p-2 items-center border border-border",
                      index === currentDayIndex && "bg-primary border-primary"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs text-muted-foreground mb-0.5",
                        index === currentDayIndex && "text-primary-foreground opacity-80"
                      )}
                    >
                      {day}
                    </Text>
                    <Text
                      className={cn(
                        "text-sm font-semibold text-foreground",
                        index === currentDayIndex && "text-primary-foreground"
                      )}
                    >
                      {formatHoursMinutes(hoursForDay)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Today's Entries */}
          <View className="mt-6 px-4">
            <Text className="text-lg font-semibold text-foreground mb-4">Registraties Vandaag</Text>
            {todayHours?.entries && todayHours.entries.length > 0 ? (
              todayHours.entries.map((entry, index) => {
                const projectInfo = todayHours.projects?.find(
                  (p) => p?.projectId.toString() === entry.projectId.toString()
                );
                return (
                  <View key={entry._id || index} className="bg-card rounded-lg p-4 mb-2 border border-border">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text
                        className="text-base font-medium text-foreground flex-1"
                        numberOfLines={1}
                      >
                        {projectInfo?.naam || 'Project'}
                      </Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatHoursMinutes(entry.uren)} uur
                      </Text>
                    </View>
                    {entry.notities && (
                      <Text
                        className="text-sm text-muted-foreground mt-1"
                        numberOfLines={2}
                      >
                        {entry.notities}
                      </Text>
                    )}
                  </View>
                );
              })
            ) : (
              <View className="bg-card rounded-lg p-6 items-center gap-2 border border-border">
                <Feather
                  name="clock"
                  size={32}
                  color={colors.mutedForeground}
                  className="mb-2"
                />
                <Text className="text-base text-muted-foreground font-medium">
                  Geen registraties vandaag
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  Klok in om je werkdag te starten
                </Text>
              </View>
            )}
          </View>
        </TabsContent>

        <TabsContent tabKey="week" activeTab={activeTab}>
          {/* Week Summary */}
          <View className="mt-6 px-4">
            <Text className="text-lg font-semibold text-foreground mb-4">Week Samenvatting</Text>
            <Card>
              <CardContent>
                <View className="flex-row justify-between items-center">
                  <Text className="text-base text-muted-foreground">Totaal uren</Text>
                  <Text className="text-lg font-bold text-foreground">
                    <AnimatedNumber
                      value={weekHours?.totalHours || 0}
                      decimals={1}
                      suffix=" uur"
                      style={{ fontSize: 18, fontWeight: 'bold' }}
                    />
                  </Text>
                </View>
                <View className="h-px bg-border my-2" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-base text-muted-foreground">Projecten</Text>
                  <Text className="text-lg font-bold text-foreground">
                    {weekHours?.projectCount || 0}
                  </Text>
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Daily Breakdown */}
          <View className="mt-6 px-4">
            <Text className="text-lg font-semibold text-foreground mb-4">Per Dag</Text>
            {weekHours?.dailyHours?.map((day, index) => (
              <View key={day.datum || index} className="bg-card rounded-lg p-4 mb-2 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-base font-medium text-foreground flex-1">
                    {day.dag} - {day.datum}
                  </Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatHoursMinutes(day.uren)} uur
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </TabsContent>

        {/* Totals Footer */}
        <View className="bg-card rounded-lg p-4 mt-6 mx-4 mb-10 border border-border">
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-muted-foreground">Totaal deze week</Text>
            <AnimatedNumber
              value={weekHours?.totalHours || 0}
              decimals={1}
              suffix=" uur"
              style={{ fontSize: 18, fontWeight: 'bold' }}
            />
          </View>
          <View className="h-px bg-border my-2" />
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-muted-foreground">Doel deze week</Text>
            <Text className="text-lg font-semibold text-muted-foreground">40:00</Text>
          </View>
        </View>
      </ScrollView>

      {/* Project Selection Modal */}
      <Modal
        visible={projectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProjectModalVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setProjectModalVisible(false)}
        >
          <View className="bg-card rounded-t-2xl max-h-[70%]">
            <View className="flex-row justify-between items-center p-4 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">Selecteer Project</Text>
              <TouchableOpacity onPress={() => setProjectModalVisible(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={cn(
                    "flex-row items-center p-4 border-b border-border",
                    selectedProject?._id === item._id && "bg-primary/10"
                  )}
                  onPress={() => handleSelectProject(item)}
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {item.naam}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-0.5">
                      {item.klantNaam}
                    </Text>
                  </View>
                  {selectedProject?._id === item._id && (
                    <Feather
                      name="check"
                      size={20}
                      color={colors.trend.positive}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="bg-card rounded-lg p-6 items-center gap-2 border border-border">
                  <Text className="text-base text-muted-foreground font-medium">
                    Geen projecten beschikbaar
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center">
                    Je hebt nog geen actieve projecten toegewezen gekregen
                  </Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Floating Action Button for Manual Entry */}
      <TouchableOpacity
        className="absolute right-5 bottom-32 w-14 h-14 rounded-full bg-primary justify-center items-center shadow-lg"
        style={{ elevation: 4 }}
        onPress={handleOpenManualEntry}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      {/* Manual Entry Modal */}
      <Modal
        visible={manualEntryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseManualEntry}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={handleCloseManualEntry}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              className="bg-card rounded-t-2xl max-h-[90%]"
            >
              <View className="flex-row justify-between items-center p-4 border-b border-border">
                <Text className="text-lg font-semibold text-foreground">Uren Toevoegen</Text>
                <TouchableOpacity onPress={handleCloseManualEntry}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="p-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Date Picker */}
                <Text className="text-sm font-medium text-foreground mb-1">
                  Datum
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {dateOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      className={cn(
                        "px-4 py-2 rounded-lg bg-secondary border border-border",
                        manualEntryDate === option.key && "bg-primary border-primary"
                      )}
                      onPress={() => setManualEntryDate(option.key)}
                    >
                      <Text
                        className={cn(
                          "text-sm text-foreground",
                          manualEntryDate === option.key && "text-primary-foreground font-medium"
                        )}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Project Selector */}
                <Text className="text-sm font-medium text-foreground mb-1 mt-4">Project *</Text>
                <TouchableOpacity
                  className="flex-row items-center justify-between bg-secondary rounded-md p-3 border border-border"
                  onPress={() => setManualEntryProjectSelectorVisible(true)}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium flex-1",
                      manualEntryProject ? "text-foreground" : "text-muted-foreground"
                    )}
                    numberOfLines={1}
                  >
                    {manualEntryProject ? manualEntryProject.naam : 'Selecteer een project'}
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>

                {/* Hours Input */}
                <Text className="text-sm font-medium text-foreground mb-1 mt-4">Uren *</Text>
                <View className="mt-1">
                  <TextInput
                    className="bg-background border border-border rounded-md p-3 text-lg text-foreground text-center font-semibold"
                    value={manualEntryHours}
                    onChangeText={setManualEntryHours}
                    placeholder="0.0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
                <View className="flex-row gap-2 mt-1">
                  {QUICK_HOURS.map((hours) => (
                    <TouchableOpacity
                      key={hours}
                      className={cn(
                        "flex-1 py-2 rounded-md bg-secondary items-center border border-border",
                        manualEntryHours === hours.toString() && "bg-primary border-primary"
                      )}
                      onPress={() => setManualEntryHours(hours.toString())}
                    >
                      <Text
                        className={cn(
                          "text-sm text-foreground font-medium",
                          manualEntryHours === hours.toString() && "text-primary-foreground"
                        )}
                      >
                        {hours}u
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Scope Selector */}
                <Text className="text-sm font-medium text-foreground mb-1 mt-4">Categorie</Text>
                <View className="flex-row flex-wrap gap-1">
                  {SCOPE_OPTIONS.map((scope) => (
                    <TouchableOpacity
                      key={scope.key}
                      className={cn(
                        "px-4 py-2 rounded-lg bg-secondary border border-border",
                        manualEntryScope === scope.key && "bg-primary border-primary"
                      )}
                      onPress={() =>
                        setManualEntryScope(
                          manualEntryScope === scope.key ? '' : scope.key
                        )
                      }
                    >
                      <Text
                        className={cn(
                          "text-sm text-foreground",
                          manualEntryScope === scope.key && "text-primary-foreground font-medium"
                        )}
                      >
                        {scope.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes Input */}
                <Text className="text-sm font-medium text-foreground mb-1 mt-4">Notities</Text>
                <TextInput
                  className="bg-background border border-border rounded-md p-3 text-base text-foreground min-h-[80px]"
                  style={{ textAlignVertical: 'top' }}
                  value={manualEntryNotes}
                  onChangeText={setManualEntryNotes}
                  placeholder="Optionele notities..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />

                {/* Submit Button */}
                <View className="p-4 pt-6 border-t border-border mt-4">
                  <Button
                    title="Opslaan"
                    onPress={handleSubmitManualEntry}
                    loading={isSubmittingManualEntry}
                    fullWidth
                    icon={
                      <Feather
                        name="check"
                        size={18}
                        color={colors.primaryForeground}
                      />
                    }
                  />
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual Entry Project Selector Modal */}
      <Modal
        visible={manualEntryProjectSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualEntryProjectSelectorVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setManualEntryProjectSelectorVisible(false)}
        >
          <View className="bg-card rounded-t-2xl max-h-[70%]">
            <View className="flex-row justify-between items-center p-4 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">Selecteer Project</Text>
              <TouchableOpacity onPress={() => setManualEntryProjectSelectorVisible(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={cn(
                    "flex-row items-center p-4 border-b border-border",
                    manualEntryProject?._id === item._id && "bg-primary/10"
                  )}
                  onPress={() => handleSelectManualEntryProject(item)}
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {item.naam}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-0.5">
                      {item.klantNaam}
                    </Text>
                  </View>
                  {manualEntryProject?._id === item._id && (
                    <Feather
                      name="check"
                      size={20}
                      color={colors.trend.positive}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="bg-card rounded-lg p-6 items-center gap-2 border border-border">
                  <Text className="text-base text-muted-foreground font-medium">
                    Geen projecten beschikbaar
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center">
                    Je hebt nog geen actieve projecten toegewezen gekregen
                  </Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
