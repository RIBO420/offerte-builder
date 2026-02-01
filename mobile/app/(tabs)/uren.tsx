import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.mutedForeground }}>Laden...</Text>
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

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        timerCard: {
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          alignItems: 'center',
          marginHorizontal: spacing.md,
          marginTop: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.card,
        },
        timerLabel: {
          fontSize: typography.fontSize.sm,
          color: colors.mutedForeground,
          marginBottom: spacing.xs,
        },
        timerValue: {
          fontSize: typography.fontSize['4xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.foreground,
          fontVariant: ['tabular-nums'],
        },
        timerStatus: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        },
        statusDot: {
          width: 10,
          height: 10,
          borderRadius: radius.full,
        },
        statusDotActive: {
          backgroundColor: colors.trend.positive,
        },
        statusDotInactive: {
          backgroundColor: colors.mutedForeground,
        },
        statusDotBreak: {
          backgroundColor: '#F59E0B', // Warning/amber color
        },
        statusText: {
          fontSize: typography.fontSize.sm,
          color: colors.mutedForeground,
        },
        timerActions: {
          flexDirection: 'row',
          gap: spacing.sm,
          width: '100%',
        },
        projectSelector: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.secondary,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginTop: spacing.md,
          width: '100%',
        },
        projectSelectorText: {
          fontSize: typography.fontSize.sm,
          color: colors.foreground,
          fontWeight: typography.fontWeight.medium,
          flex: 1,
        },
        projectSelectorPlaceholder: {
          color: colors.mutedForeground,
        },
        section: {
          marginTop: spacing.lg,
          paddingHorizontal: spacing.md,
        },
        sectionTitle: {
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
          color: colors.foreground,
          marginBottom: spacing.md,
        },
        weekGrid: {
          flexDirection: 'row',
          gap: spacing.xs,
        },
        dayCard: {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.sm,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        dayCardActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dayLabel: {
          fontSize: typography.fontSize.xs,
          color: colors.mutedForeground,
          marginBottom: spacing.xs / 2,
        },
        dayLabelActive: {
          color: colors.primaryForeground,
          opacity: 0.8,
        },
        dayHours: {
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.foreground,
        },
        dayHoursActive: {
          color: colors.primaryForeground,
        },
        entryCard: {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        entryHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        entryProject: {
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.medium,
          color: colors.foreground,
          flex: 1,
        },
        entryHours: {
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.semibold,
          color: colors.foreground,
        },
        entryDetails: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        entryNotes: {
          fontSize: typography.fontSize.sm,
          color: colors.mutedForeground,
          marginTop: spacing.xs,
        },
        emptyState: {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.xl,
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        emptyIcon: {
          marginBottom: spacing.sm,
        },
        emptyText: {
          fontSize: typography.fontSize.base,
          color: colors.mutedForeground,
          fontWeight: typography.fontWeight.medium,
        },
        emptySubtext: {
          fontSize: typography.fontSize.sm,
          color: colors.mutedForeground,
          textAlign: 'center',
        },
        totalsCard: {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginTop: spacing.lg,
          marginHorizontal: spacing.md,
          marginBottom: spacing.xl,
          borderWidth: 1,
          borderColor: colors.border,
        },
        totalRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        totalLabel: {
          fontSize: typography.fontSize.base,
          color: colors.mutedForeground,
        },
        totalValue: {
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.bold,
          color: colors.foreground,
        },
        totalValueMuted: {
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
          color: colors.mutedForeground,
        },
        totalDivider: {
          height: 1,
          backgroundColor: colors.border,
          marginVertical: spacing.sm,
        },
        // Modal styles
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        modalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          maxHeight: '70%',
        },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        modalTitle: {
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
          color: colors.foreground,
        },
        projectItem: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        projectItemContent: {
          flex: 1,
        },
        projectItemName: {
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.medium,
          color: colors.foreground,
        },
        projectItemClient: {
          fontSize: typography.fontSize.sm,
          color: colors.mutedForeground,
          marginTop: spacing.xs / 2,
        },
        projectItemSelected: {
          backgroundColor: `${colors.primary}10`,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        },
        tabsContainer: {
          backgroundColor: colors.card,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        // FAB styles
        fab: {
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.card,
          elevation: 4,
        },
        // Manual entry modal styles
        manualEntryModalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          maxHeight: '90%',
        },
        manualEntryForm: {
          padding: spacing.md,
        },
        formLabel: {
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: colors.foreground,
          marginBottom: spacing.xs,
          marginTop: spacing.md,
        },
        formLabelFirst: {
          marginTop: 0,
        },
        // Date picker styles
        datePickerContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        dateChip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: colors.secondary,
          borderWidth: 1,
          borderColor: colors.border,
        },
        dateChipSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dateChipText: {
          fontSize: typography.fontSize.sm,
          color: colors.foreground,
        },
        dateChipTextSelected: {
          color: colors.primaryForeground,
          fontWeight: typography.fontWeight.medium,
        },
        // Quick hours styles
        quickHoursContainer: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.xs,
        },
        quickHourButton: {
          flex: 1,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: colors.secondary,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        quickHourButtonSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        quickHourText: {
          fontSize: typography.fontSize.sm,
          color: colors.foreground,
          fontWeight: typography.fontWeight.medium,
        },
        quickHourTextSelected: {
          color: colors.primaryForeground,
        },
        // Scope styles
        scopeContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        scopeChip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: colors.secondary,
          borderWidth: 1,
          borderColor: colors.border,
        },
        scopeChipSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        scopeChipText: {
          fontSize: typography.fontSize.sm,
          color: colors.foreground,
        },
        scopeChipTextSelected: {
          color: colors.primaryForeground,
          fontWeight: typography.fontWeight.medium,
        },
        // Project selector for manual entry
        manualProjectSelector: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.secondary,
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        // Submit button area
        submitButtonArea: {
          padding: spacing.md,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          marginTop: spacing.md,
        },
        // Hours input container
        hoursInputContainer: {
          marginTop: spacing.xs,
        },
        hoursInput: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          fontSize: typography.fontSize.lg,
          color: colors.foreground,
          textAlign: 'center',
          fontWeight: typography.fontWeight.semibold,
        },
        notesInput: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          fontSize: typography.fontSize.base,
          color: colors.foreground,
          minHeight: 80,
          textAlignVertical: 'top',
        },
      }),
    [colors]
  );

  // Loading state - show loading while data is loading
  if (activeSession === undefined || todayHours === undefined) {
    return (
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[dynamicStyles.emptyText, { marginTop: spacing.md }]}>
            Laden...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Tabs */}
      <View style={dynamicStyles.tabsContainer}>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as TabType)}
          variant="default"
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing['2xl'] }}
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
        <View style={dynamicStyles.timerCard}>
          <Text style={dynamicStyles.timerLabel}>
            {isClockedIn ? 'Huidige sessie' : 'Vandaag gewerkt'}
          </Text>
          <Text style={dynamicStyles.timerValue}>
            {isClockedIn
              ? formatTime(elapsedSeconds)
              : formatTime(Math.floor((todayHours?.totalHours || 0) * 3600))}
          </Text>

          <View style={dynamicStyles.timerStatus}>
            <View
              style={[
                dynamicStyles.statusDot,
                isClockedIn
                  ? isOnBreak
                    ? dynamicStyles.statusDotBreak
                    : dynamicStyles.statusDotActive
                  : dynamicStyles.statusDotInactive,
              ]}
            />
            <Text style={dynamicStyles.statusText}>
              {isClockedIn
                ? isOnBreak
                  ? 'Op pauze'
                  : 'Ingeklokt'
                : 'Niet ingeklokt'}
            </Text>
          </View>

          {/* Project Selector */}
          <TouchableOpacity
            style={dynamicStyles.projectSelector}
            onPress={() => setProjectModalVisible(true)}
            disabled={isClockedIn}
          >
            <Text
              style={[
                dynamicStyles.projectSelectorText,
                !selectedProject && dynamicStyles.projectSelectorPlaceholder,
              ]}
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
          <View style={[dynamicStyles.timerActions, { marginTop: spacing.md }]}>
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
                <View style={{ flex: 1 }}>
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
                <View style={{ flex: 1 }}>
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
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Week Overzicht</Text>
            <View style={dynamicStyles.weekGrid}>
              {weekDays.map((day, index) => {
                const dayData = weekHours?.dailyHours?.[index];
                const hoursForDay = dayData?.uren || 0;

                return (
                  <View
                    key={day}
                    style={[
                      dynamicStyles.dayCard,
                      index === currentDayIndex && dynamicStyles.dayCardActive,
                    ]}
                  >
                    <Text
                      style={[
                        dynamicStyles.dayLabel,
                        index === currentDayIndex && dynamicStyles.dayLabelActive,
                      ]}
                    >
                      {day}
                    </Text>
                    <Text
                      style={[
                        dynamicStyles.dayHours,
                        index === currentDayIndex && dynamicStyles.dayHoursActive,
                      ]}
                    >
                      {formatHoursMinutes(hoursForDay)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Today's Entries */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Registraties Vandaag</Text>
            {todayHours?.entries && todayHours.entries.length > 0 ? (
              todayHours.entries.map((entry, index) => {
                const projectInfo = todayHours.projects?.find(
                  (p) => p?.projectId.toString() === entry.projectId.toString()
                );
                return (
                  <View key={entry._id || index} style={dynamicStyles.entryCard}>
                    <View style={dynamicStyles.entryHeader}>
                      <Text
                        style={dynamicStyles.entryProject}
                        numberOfLines={1}
                      >
                        {projectInfo?.naam || 'Project'}
                      </Text>
                      <Text style={dynamicStyles.entryHours}>
                        {formatHoursMinutes(entry.uren)} uur
                      </Text>
                    </View>
                    {entry.notities && (
                      <Text
                        style={dynamicStyles.entryNotes}
                        numberOfLines={2}
                      >
                        {entry.notities}
                      </Text>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={dynamicStyles.emptyState}>
                <Feather
                  name="clock"
                  size={32}
                  color={colors.mutedForeground}
                  style={dynamicStyles.emptyIcon}
                />
                <Text style={dynamicStyles.emptyText}>
                  Geen registraties vandaag
                </Text>
                <Text style={dynamicStyles.emptySubtext}>
                  Klok in om je werkdag te starten
                </Text>
              </View>
            )}
          </View>
        </TabsContent>

        <TabsContent tabKey="week" activeTab={activeTab}>
          {/* Week Summary */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Week Samenvatting</Text>
            <Card>
              <CardContent>
                <View style={dynamicStyles.totalRow}>
                  <Text style={dynamicStyles.totalLabel}>Totaal uren</Text>
                  <Text style={dynamicStyles.totalValue}>
                    <AnimatedNumber
                      value={weekHours?.totalHours || 0}
                      decimals={1}
                      suffix=" uur"
                      style={dynamicStyles.totalValue}
                    />
                  </Text>
                </View>
                <View style={dynamicStyles.totalDivider} />
                <View style={dynamicStyles.totalRow}>
                  <Text style={dynamicStyles.totalLabel}>Projecten</Text>
                  <Text style={dynamicStyles.totalValue}>
                    {weekHours?.projectCount || 0}
                  </Text>
                </View>
              </CardContent>
            </Card>
          </View>

          {/* Daily Breakdown */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Per Dag</Text>
            {weekHours?.dailyHours?.map((day, index) => (
              <View key={day.datum || index} style={dynamicStyles.entryCard}>
                <View style={dynamicStyles.entryHeader}>
                  <Text style={dynamicStyles.entryProject}>
                    {day.dag} - {day.datum}
                  </Text>
                  <Text style={dynamicStyles.entryHours}>
                    {formatHoursMinutes(day.uren)} uur
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </TabsContent>

        {/* Totals Footer */}
        <View style={dynamicStyles.totalsCard}>
          <View style={dynamicStyles.totalRow}>
            <Text style={dynamicStyles.totalLabel}>Totaal deze week</Text>
            <AnimatedNumber
              value={weekHours?.totalHours || 0}
              decimals={1}
              suffix=" uur"
              style={dynamicStyles.totalValue}
            />
          </View>
          <View style={dynamicStyles.totalDivider} />
          <View style={dynamicStyles.totalRow}>
            <Text style={dynamicStyles.totalLabel}>Doel deze week</Text>
            <Text style={dynamicStyles.totalValueMuted}>40:00</Text>
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
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProjectModalVisible(false)}
        >
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Selecteer Project</Text>
              <TouchableOpacity onPress={() => setProjectModalVisible(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    dynamicStyles.projectItem,
                    selectedProject?._id === item._id &&
                      dynamicStyles.projectItemSelected,
                  ]}
                  onPress={() => handleSelectProject(item)}
                >
                  <View style={dynamicStyles.projectItemContent}>
                    <Text style={dynamicStyles.projectItemName}>
                      {item.naam}
                    </Text>
                    <Text style={dynamicStyles.projectItemClient}>
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
                <View style={dynamicStyles.emptyState}>
                  <Text style={dynamicStyles.emptyText}>
                    Geen projecten beschikbaar
                  </Text>
                  <Text style={dynamicStyles.emptySubtext}>
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
        style={dynamicStyles.fab}
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
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={dynamicStyles.modalOverlay}
            activeOpacity={1}
            onPress={handleCloseManualEntry}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={dynamicStyles.manualEntryModalContent}
            >
              <View style={dynamicStyles.modalHeader}>
                <Text style={dynamicStyles.modalTitle}>Uren Toevoegen</Text>
                <TouchableOpacity onPress={handleCloseManualEntry}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={dynamicStyles.manualEntryForm}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Date Picker */}
                <Text style={[dynamicStyles.formLabel, dynamicStyles.formLabelFirst]}>
                  Datum
                </Text>
                <View style={dynamicStyles.datePickerContainer}>
                  {dateOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        dynamicStyles.dateChip,
                        manualEntryDate === option.key && dynamicStyles.dateChipSelected,
                      ]}
                      onPress={() => setManualEntryDate(option.key)}
                    >
                      <Text
                        style={[
                          dynamicStyles.dateChipText,
                          manualEntryDate === option.key && dynamicStyles.dateChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Project Selector */}
                <Text style={dynamicStyles.formLabel}>Project *</Text>
                <TouchableOpacity
                  style={dynamicStyles.manualProjectSelector}
                  onPress={() => setManualEntryProjectSelectorVisible(true)}
                >
                  <Text
                    style={[
                      dynamicStyles.projectSelectorText,
                      !manualEntryProject && dynamicStyles.projectSelectorPlaceholder,
                    ]}
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
                <Text style={dynamicStyles.formLabel}>Uren *</Text>
                <View style={dynamicStyles.hoursInputContainer}>
                  <TextInput
                    style={dynamicStyles.hoursInput}
                    value={manualEntryHours}
                    onChangeText={setManualEntryHours}
                    placeholder="0.0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
                <View style={dynamicStyles.quickHoursContainer}>
                  {QUICK_HOURS.map((hours) => (
                    <TouchableOpacity
                      key={hours}
                      style={[
                        dynamicStyles.quickHourButton,
                        manualEntryHours === hours.toString() &&
                          dynamicStyles.quickHourButtonSelected,
                      ]}
                      onPress={() => setManualEntryHours(hours.toString())}
                    >
                      <Text
                        style={[
                          dynamicStyles.quickHourText,
                          manualEntryHours === hours.toString() &&
                            dynamicStyles.quickHourTextSelected,
                        ]}
                      >
                        {hours}u
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Scope Selector */}
                <Text style={dynamicStyles.formLabel}>Categorie</Text>
                <View style={dynamicStyles.scopeContainer}>
                  {SCOPE_OPTIONS.map((scope) => (
                    <TouchableOpacity
                      key={scope.key}
                      style={[
                        dynamicStyles.scopeChip,
                        manualEntryScope === scope.key && dynamicStyles.scopeChipSelected,
                      ]}
                      onPress={() =>
                        setManualEntryScope(
                          manualEntryScope === scope.key ? '' : scope.key
                        )
                      }
                    >
                      <Text
                        style={[
                          dynamicStyles.scopeChipText,
                          manualEntryScope === scope.key && dynamicStyles.scopeChipTextSelected,
                        ]}
                      >
                        {scope.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes Input */}
                <Text style={dynamicStyles.formLabel}>Notities</Text>
                <TextInput
                  style={dynamicStyles.notesInput}
                  value={manualEntryNotes}
                  onChangeText={setManualEntryNotes}
                  placeholder="Optionele notities..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />

                {/* Submit Button */}
                <View style={dynamicStyles.submitButtonArea}>
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
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setManualEntryProjectSelectorVisible(false)}
        >
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Selecteer Project</Text>
              <TouchableOpacity onPress={() => setManualEntryProjectSelectorVisible(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    dynamicStyles.projectItem,
                    manualEntryProject?._id === item._id &&
                      dynamicStyles.projectItemSelected,
                  ]}
                  onPress={() => handleSelectManualEntryProject(item)}
                >
                  <View style={dynamicStyles.projectItemContent}>
                    <Text style={dynamicStyles.projectItemName}>
                      {item.naam}
                    </Text>
                    <Text style={dynamicStyles.projectItemClient}>
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
                <View style={dynamicStyles.emptyState}>
                  <Text style={dynamicStyles.emptyText}>
                    Geen projecten beschikbaar
                  </Text>
                  <Text style={dynamicStyles.emptySubtext}>
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
