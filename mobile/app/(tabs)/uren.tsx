import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { hapticPatterns } from '../../theme/haptics';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  Button,
  Badge,
  AnimatedNumber,
  Input,
  ScopeTag,
  Skeleton,
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

// Helper: get week days with date numbers for the current week
function getWeekDaysWithDates(): { name: string; dateNum: number; dateStr: string; isToday: boolean }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);

  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const todayStr = now.toISOString().split('T')[0];

  return dayNames.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    return {
      name,
      dateNum: d.getDate(),
      dateStr,
      isToday: dateStr === todayStr,
    };
  });
}

// Wrapper component that handles auth check
export default function UrenScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading with Skeleton while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
        {/* Header skeleton */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Skeleton width={60} height={10} className="mb-2" />
          <Skeleton width={80} height={24} />
        </View>
        {/* Week selector skeleton */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 8 }}>
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} width={44} height={64} borderRadius={12} />
          ))}
        </View>
        {/* Timer skeleton */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <Skeleton width={120} height={40} borderRadius={8} />
        </View>
        {/* Entries skeleton */}
        <View style={{ paddingHorizontal: 16, marginTop: 32, gap: 12 }}>
          <Skeleton width={140} height={16} />
          <Skeleton height={72} borderRadius={16} />
          <Skeleton height={72} borderRadius={16} />
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

  // Selected day in week overview
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });

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

  // Hour increment/decrement for manual entry
  const handleIncrementHours = useCallback(() => {
    hapticPatterns.tap();
    setManualEntryHours((prev) => {
      const current = parseFloat(prev) || 0;
      const next = Math.min(current + 0.5, 24);
      return next.toString();
    });
  }, []);

  const handleDecrementHours = useCallback(() => {
    hapticPatterns.tap();
    setManualEntryHours((prev) => {
      const current = parseFloat(prev) || 0;
      const next = Math.max(current - 0.5, 0);
      return next.toString();
    });
  }, []);

  // Date options for manual entry (last 7 days)
  const dateOptions = useMemo(() => getDateOptions(7), []);

  // Week days with date info
  const weekDaysWithDates = useMemo(() => getWeekDaysWithDates(), []);

  const currentDayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday-based index
  }, []);

  // Scope color mapping for entry indicators
  const scopeColors: Record<string, string> = {
    grondwerk: '#8B6914',
    bestrating: '#6B7280',
    borders: '#4ADE80',
    gras: '#22C55E',
    houtwerk: '#A0522D',
    water: '#3B82F6',
    specials: '#A855F7',
  };

  // Extract scope from notities string (format: [scope] notes)
  const extractScope = (notities?: string): string | null => {
    if (!notities) return null;
    const match = notities.match(/^\[(\w+)\]/);
    return match ? match[1] : null;
  };

  // Extract notes without scope prefix
  const extractNotes = (notities?: string): string => {
    if (!notities) return '';
    return notities.replace(/^\[\w+\]\s*/, '');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 9, fontWeight: '600', color: '#6B8F6B', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
          TOP TUINEN
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '600', color: '#E8E8E8' }}>
          Uren
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ADE80"
          />
        }
      >
        {/* Week Day Selector Row */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 20 }}>
          {weekDaysWithDates.map((day, index) => {
            const isActive = index === selectedDayIndex;
            const dayData = weekHours?.dailyHours?.[index];
            const hoursForDay = dayData?.uren || 0;

            return (
              <TouchableOpacity
                key={day.name}
                onPress={() => {
                  hapticPatterns.selection();
                  setSelectedDayIndex(index);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: isActive ? '#4ADE80' : 'transparent',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: isActive ? '#0A0A0A' : '#555555',
                  marginBottom: 4,
                }}>
                  {day.name}
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isActive ? '#0A0A0A' : '#555555',
                }}>
                  {day.dateNum}
                </Text>
                {/* Today indicator dot */}
                {day.isToday && (
                  <View style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isActive ? '#0A0A0A' : '#4ADE80',
                    marginTop: 4,
                  }} />
                )}
                {/* Hours for day (subtle) */}
                {hoursForDay > 0 && (
                  <Text style={{
                    fontSize: 9,
                    fontWeight: '600',
                    color: isActive ? '#0A0A0A' : '#6B8F6B',
                    marginTop: 2,
                  }}>
                    {formatHoursMinutes(hoursForDay)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Timer / Clock Section */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {/* Status indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isClockedIn
                ? isOnBreak ? '#F59E0B' : '#4ADE80'
                : '#555555',
            }} />
            <Text style={{ fontSize: 12, color: '#888888' }}>
              {isClockedIn
                ? isOnBreak ? 'Op pauze' : 'Ingeklokt'
                : 'Niet ingeklokt'}
            </Text>
          </View>

          {/* Large timer display */}
          <Text style={{
            fontSize: 40,
            fontWeight: '700',
            color: '#E8E8E8',
            fontVariant: ['tabular-nums'],
            letterSpacing: 1,
          }}>
            {isClockedIn
              ? formatTime(elapsedSeconds)
              : formatTime(Math.floor((todayHours?.totalHours || 0) * 3600))}
          </Text>

          <Text style={{ fontSize: 12, color: '#555555', marginTop: 4 }}>
            {isClockedIn ? 'Huidige sessie' : 'Vandaag gewerkt'}
          </Text>

          {/* Project selector */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: '#222222',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginTop: 16,
              width: '85%',
            }}
            onPress={() => setProjectModalVisible(true)}
            disabled={isClockedIn}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: selectedProject ? '#E8E8E8' : '#555555',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {selectedProject ? selectedProject.naam : 'Selecteer een project'}
            </Text>
            <Feather name="chevron-down" size={18} color="#555555" />
          </TouchableOpacity>

          {/* Clock action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '85%' }}>
            {!isClockedIn ? (
              <View style={{ flex: 1 }}>
                <Button
                  title="Inklokken"
                  onPress={handleClockIn}
                  loading={isClockingIn}
                  variant="nature"
                  size="lg"
                  fullWidth
                  icon={<Feather name="play" size={18} color="#4ADE80" />}
                />
              </View>
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
                        color="#6B8F6B"
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
                    icon={<Feather name="square" size={18} color="#FAFAFA" />}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Week Total Summary Card */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Card variant="nature">
            <CardContent>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 11, color: '#6B8F6B', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
                    Deze week
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                    <AnimatedNumber
                      value={weekHours?.totalHours || 0}
                      decimals={1}
                      suffix=""
                      style={{ fontSize: 28, fontWeight: '700', color: '#4ADE80' }}
                    />
                    <Text style={{ fontSize: 14, color: '#6B8F6B', marginLeft: 4 }}>/ 40 uur</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: '#6B8F6B', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
                    Projecten
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#4ADE80', marginTop: 4 }}>
                    {weekHours?.projectCount || 0}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* Recent Entries */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Registraties vandaag
          </Text>

          {todayHours === undefined ? (
            // Loading state
            <View style={{ gap: 12 }}>
              <Skeleton height={72} borderRadius={16} />
              <Skeleton height={72} borderRadius={16} />
            </View>
          ) : todayHours?.entries && todayHours.entries.length > 0 ? (
            todayHours.entries.map((entry, index) => {
              const projectInfo = todayHours.projects?.find(
                (p) => p?.projectId.toString() === entry.projectId.toString()
              );
              const scope = extractScope(entry.notities);
              const notes = extractNotes(entry.notities);
              const indicatorColor = scope && scopeColors[scope] ? scopeColors[scope] : '#4ADE80';

              return (
                <Card key={entry._id || index} variant="default" className="mb-3">
                  <View style={{ flexDirection: 'row' }}>
                    {/* Scope color indicator on left */}
                    <View style={{
                      width: 3,
                      borderRadius: 2,
                      backgroundColor: indicatorColor,
                      marginRight: 12,
                      minHeight: 40,
                    }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text
                          style={{ fontSize: 15, fontWeight: '600', color: '#E8E8E8', flex: 1 }}
                          numberOfLines={1}
                        >
                          {projectInfo?.naam || 'Project'}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ADE80' }}>
                          {formatHoursMinutes(entry.uren)} uur
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        {scope && (
                          <ScopeTag scope={scope as any} size="sm" />
                        )}
                        {notes ? (
                          <Text
                            style={{ fontSize: 13, color: '#888888', flex: 1 }}
                            numberOfLines={1}
                          >
                            {notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <Card variant="default">
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Feather name="clock" size={28} color="#555555" style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#888888' }}>
                  Geen registraties vandaag
                </Text>
                <Text style={{ fontSize: 12, color: '#555555', marginTop: 4, textAlign: 'center' }}>
                  Klok in om je werkdag te starten
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* Week Breakdown (only visible when viewing week data) */}
        {weekHours?.dailyHours && weekHours.dailyHours.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Week overzicht
            </Text>
            {weekHours.dailyHours.map((day, index) => (
              <Card key={day.datum || index} variant="default" className="mb-2">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 3,
                      height: 24,
                      borderRadius: 2,
                      backgroundColor: index === currentDayIndex ? '#4ADE80' : '#222222',
                    }} />
                    <Text style={{ fontSize: 14, fontWeight: '500', color: index === currentDayIndex ? '#E8E8E8' : '#888888' }}>
                      {day.dag}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: day.uren > 0 ? '#E8E8E8' : '#555555' }}>
                    {formatHoursMinutes(day.uren)} uur
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Project Selection Modal */}
      <Modal
        visible={projectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProjectModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setProjectModalVisible(false)}
        >
          <View style={{ backgroundColor: '#111111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#E8E8E8' }}>Selecteer Project</Text>
              <TouchableOpacity onPress={() => setProjectModalVisible(false)}>
                <Feather name="x" size={22} color="#888888" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#222222',
                    backgroundColor: selectedProject?._id === item._id ? 'rgba(74,222,128,0.08)' : 'transparent',
                  }}
                  onPress={() => handleSelectProject(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#E8E8E8' }}>
                      {item.naam}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#888888', marginTop: 2 }}>
                      {item.klantNaam}
                    </Text>
                  </View>
                  {selectedProject?._id === item._id && (
                    <Feather name="check" size={20} color="#4ADE80" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#888888' }}>
                    Geen projecten beschikbaar
                  </Text>
                  <Text style={{ fontSize: 12, color: '#555555', textAlign: 'center', marginTop: 4 }}>
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
        style={{
          position: 'absolute',
          right: 20,
          bottom: 120,
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: '#4ADE80',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#4ADE80',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
        onPress={handleOpenManualEntry}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={22} color="#0A0A0A" />
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
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={handleCloseManualEntry}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={{ backgroundColor: '#111111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}
            >
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#E8E8E8' }}>Uren Toevoegen</Text>
                <TouchableOpacity onPress={handleCloseManualEntry}>
                  <Feather name="x" size={22} color="#888888" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ padding: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Date Picker */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Datum
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {dateOptions.map((option) => {
                    const isSelected = manualEntryDate === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: isSelected ? '#4ADE80' : '#1A1A1A',
                          borderWidth: 1,
                          borderColor: isSelected ? '#4ADE80' : '#222222',
                        }}
                        onPress={() => setManualEntryDate(option.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? '#0A0A0A' : '#E8E8E8',
                        }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Project Selector */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                  Project *
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#1A1A1A',
                    borderWidth: 1,
                    borderColor: '#222222',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                  onPress={() => setManualEntryProjectSelectorVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: manualEntryProject ? '#E8E8E8' : '#555555',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {manualEntryProject ? manualEntryProject.naam : 'Selecteer een project'}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#555555" />
                </TouchableOpacity>

                {/* Hour Input with +/- */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                  Uren *
                </Text>
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    {/* Decrement button */}
                    <TouchableOpacity
                      onPress={handleDecrementHours}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: '#1A1A1A',
                        borderWidth: 1,
                        borderColor: '#222222',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="minus" size={20} color="#E8E8E8" />
                    </TouchableOpacity>

                    {/* Large centered number */}
                    <Text style={{
                      fontSize: 34,
                      fontWeight: '700',
                      color: '#E8E8E8',
                      minWidth: 80,
                      textAlign: 'center',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {manualEntryHours || '0'}
                    </Text>

                    {/* Increment button */}
                    <TouchableOpacity
                      onPress={handleIncrementHours}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: '#1A1A1A',
                        borderWidth: 1,
                        borderColor: '#222222',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="plus" size={20} color="#E8E8E8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick hour buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {QUICK_HOURS.map((hours) => {
                    const isSelected = manualEntryHours === hours.toString();
                    return (
                      <TouchableOpacity
                        key={hours}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: isSelected ? '#4ADE80' : '#1A1A1A',
                          borderWidth: 1,
                          borderColor: isSelected ? '#4ADE80' : '#222222',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          hapticPatterns.selection();
                          setManualEntryHours(hours.toString());
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: isSelected ? '#0A0A0A' : '#E8E8E8',
                        }}>
                          {hours}u
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Scope Selector using ScopeTag */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                  Categorie
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {SCOPE_OPTIONS.map((scope) => {
                    const isSelected = manualEntryScope === scope.key;
                    return (
                      <TouchableOpacity
                        key={scope.key}
                        onPress={() =>
                          setManualEntryScope(
                            manualEntryScope === scope.key ? '' : scope.key
                          )
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: isSelected ? '#4ADE80' : '#1A1A1A',
                          borderWidth: 1,
                          borderColor: isSelected ? '#4ADE80' : '#222222',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? '#0A0A0A' : '#E8E8E8',
                        }}>
                          {scope.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Notes Input */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                  Notities
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#1A1A1A',
                    borderWidth: 1,
                    borderColor: '#222222',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 14,
                    color: '#E8E8E8',
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  value={manualEntryNotes}
                  onChangeText={setManualEntryNotes}
                  placeholder="Optionele notities..."
                  placeholderTextColor="#555555"
                  multiline
                  numberOfLines={3}
                />

                {/* Submit Button */}
                <View style={{ paddingTop: 20, paddingBottom: 32 }}>
                  <Button
                    title="Opslaan"
                    onPress={handleSubmitManualEntry}
                    loading={isSubmittingManualEntry}
                    variant="nature"
                    size="lg"
                    fullWidth
                    icon={<Feather name="check" size={18} color="#4ADE80" />}
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
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setManualEntryProjectSelectorVisible(false)}
        >
          <View style={{ backgroundColor: '#111111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#E8E8E8' }}>Selecteer Project</Text>
              <TouchableOpacity onPress={() => setManualEntryProjectSelectorVisible(false)}>
                <Feather name="x" size={22} color="#888888" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={assignedProjects || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#222222',
                    backgroundColor: manualEntryProject?._id === item._id ? 'rgba(74,222,128,0.08)' : 'transparent',
                  }}
                  onPress={() => handleSelectManualEntryProject(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#E8E8E8' }}>
                      {item.naam}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#888888', marginTop: 2 }}>
                      {item.klantNaam}
                    </Text>
                  </View>
                  {manualEntryProject?._id === item._id && (
                    <Feather name="check" size={20} color="#4ADE80" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#888888' }}>
                    Geen projecten beschikbaar
                  </Text>
                  <Text style={{ fontSize: 12, color: '#555555', textAlign: 'center', marginTop: 4 }}>
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
