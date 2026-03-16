import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useColors } from '../../theme';
import {
  ParallaxHeader,
  AnimatedNumber,
  ScopeTag,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
} from '../../components/ui';

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  gepland: { bg: '#F59E0B33', text: '#F59E0B' },
  in_uitvoering: { bg: '#4ADE8033', text: '#4ADE80' },
  afgerond: { bg: '#3B82F633', text: '#3B82F6' },
  on_hold: { bg: '#6B728033', text: '#6B7280' },
};

// Scope color mapping
const SCOPE_COLORS: Record<string, string> = {
  grondwerk: '#B09070',
  bestrating: '#9A9CA0',
  borders: '#4D8C4D',
  gras: '#7DD98C',
  houtwerk: '#A87A50',
  water: '#5AA0D0',
  specials: '#B070D0',
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();

  const projectData = useQuery(
    api.mobile.getProjectDetailsForMedewerker,
    id ? { projectId: id as Id<'projecten'> } : 'skip'
  );

  if (!id) {
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyText}>Geen project ID</Text>
      </View>
    );
  }

  if (projectData === undefined) {
    return (
      <View style={s.loadingContainer}>
        <SafeAreaView style={s.flex1} edges={['top']}>
          <View style={s.loadingHeader}>
            <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
              <Feather name="arrow-left" size={24} color="#E8E8E8" />
            </TouchableOpacity>
            <Skeleton width={200} height={24} />
          </View>
          <View style={s.loadingBody}>
            <Skeleton width="100%" height={150} className="rounded-2xl mb-3" />
            <Skeleton width="100%" height={200} className="rounded-2xl mb-3" />
            <Skeleton width="100%" height={150} className="rounded-2xl" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if ('error' in projectData) {
    return (
      <View style={s.loadingContainer}>
        <SafeAreaView style={s.flex1} edges={['top']}>
          <View style={s.loadingHeader}>
            <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
              <Feather name="arrow-left" size={24} color="#E8E8E8" />
            </TouchableOpacity>
            <Text style={s.errorTitle}>Fout</Text>
          </View>
          <View style={s.errorBody}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={s.errorHeading}>Geen toegang</Text>
            <Text style={s.errorMessage}>{projectData.error}</Text>
            <TouchableOpacity onPress={() => router.back()} style={s.errorButton}>
              <Text style={s.errorButtonText}>Terug</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { project, offerte, voorcalculatie, planningTaken, medewerkerUren } = projectData;
  const statusColor = STATUS_COLORS[project.status] || STATUS_COLORS.gepland;

  // Calculate progress from planning tasks
  const totalTaken = planningTaken?.length || 0;
  const completedTaken = planningTaken?.filter((t) => t.status === 'completed').length || 0;
  const progressPercent = totalTaken > 0 ? Math.round((completedTaken / totalTaken) * 100) : 0;

  // Build subtitle from scopes or description
  const subtitleText = offerte?.scopes
    ? offerte.scopes.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')
    : project.status.replace('_', ' ');

  return (
    <View style={s.container}>
      <SafeAreaView style={s.flex1} edges={['top']}>
        {/* Back button overlay */}
        <View style={s.backOverlay}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButtonCircle}>
            <Feather name="arrow-left" size={20} color="#E8E8E8" />
          </TouchableOpacity>
          <View style={[s.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[s.statusText, { color: statusColor.text }]}>
              {project.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <ParallaxHeader
          title={project.naam}
          subtitle={subtitleText}
          height={200}
        >
          <View style={s.content}>
            {/* Progress Section */}
            <View style={s.progressSection}>
              <View style={s.progressRow}>
                <AnimatedNumber
                  value={progressPercent}
                  suffix="%"
                  style={s.progressNumber}
                />
                <Text style={s.progressLabel}>voltooid</Text>
              </View>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Scope Tags Row */}
            {offerte?.scopes && offerte.scopes.length > 0 && (
              <View style={s.scopeRow}>
                {offerte.scopes.map((scope: string) => (
                  <ScopeTag
                    key={scope}
                    scope={scope as any}
                    size="sm"
                  />
                ))}
              </View>
            )}

            {/* Quick Actions Row */}
            <View style={s.quickActionsRow}>
              <TouchableOpacity style={s.quickAction}>
                <Feather name="camera" size={20} color="#6B8F6B" />
                <Text style={s.quickActionLabel}>Foto's</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.quickAction}>
                <Feather name="clock" size={20} color="#6B8F6B" />
                <Text style={s.quickActionLabel}>Uren</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.quickAction}>
                <Feather name="file-text" size={20} color="#6B8F6B" />
                <Text style={s.quickActionLabel}>Notities</Text>
              </TouchableOpacity>
            </View>

            {/* DETAILS Section */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>DETAILS</Text>
              <View style={s.card}>
                {offerte?.klant?.adres && (
                  <View style={s.detailRow}>
                    <Feather name="map-pin" size={16} color="#555" />
                    <View style={s.detailContent}>
                      <Text style={s.detailText}>{offerte.klant.adres}</Text>
                      <Text style={s.detailSubText}>
                        {offerte.klant.postcode} {offerte.klant.plaats}
                      </Text>
                    </View>
                  </View>
                )}
                {project.startDatum && (
                  <View style={[s.detailRow, offerte?.klant?.adres && s.detailRowBorder]}>
                    <Feather name="calendar" size={16} color="#555" />
                    <View style={s.detailContent}>
                      <Text style={s.detailSubText}>Startdatum</Text>
                      <Text style={s.detailText}>
                        {new Date(project.startDatum).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                )}
                {project.deadline && (
                  <View style={[s.detailRow, s.detailRowBorder]}>
                    <Feather name="flag" size={16} color="#555" />
                    <View style={s.detailContent}>
                      <Text style={s.detailSubText}>Deadline</Text>
                      <Text style={s.detailText}>
                        {new Date(project.deadline).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                )}
                {offerte?.klant?.telefoon && (
                  <View style={[s.detailRow, s.detailRowBorder]}>
                    <Feather name="phone" size={16} color="#555" />
                    <View style={s.detailContent}>
                      <Text style={s.detailSubText}>Telefoon</Text>
                      <Text style={[s.detailText, { color: '#4ADE80' }]}>
                        {offerte.klant.telefoon}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* TEAM Section */}
            {voorcalculatie && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>TEAM</Text>
                <View style={s.card}>
                  <View style={s.teamGrid}>
                    {voorcalculatie.teamleden.map((naam: string, index: number) => (
                      <View key={index} style={s.teamMember}>
                        <View style={s.avatar}>
                          <Text style={s.avatarText}>
                            {naam.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={s.teamName} numberOfLines={1}>{naam}</Text>
                      </View>
                    ))}
                  </View>
                  {voorcalculatie.geschatteDagen && (
                    <View style={s.teamFooter}>
                      <Feather name="calendar" size={14} color="#888" />
                      <Text style={s.teamFooterText}>
                        Geschatte duur: {voorcalculatie.geschatteDagen} dagen
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ACTIVITEIT Section */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>ACTIVITEIT</Text>
              <View style={s.card}>
                {/* Recent uren registraties as timeline */}
                {medewerkerUren && medewerkerUren.registraties.length > 0 ? (
                  <>
                    <View style={s.activityHeader}>
                      <Text style={s.activityTotal}>
                        {medewerkerUren.totaalUren.toFixed(1)} uur totaal
                      </Text>
                    </View>
                    {medewerkerUren.registraties.slice(0, 5).map((reg, index) => (
                      <View
                        key={index}
                        style={[
                          s.timelineItem,
                          index < Math.min(medewerkerUren.registraties.length, 5) - 1 &&
                            s.timelineItemBorder,
                        ]}
                      >
                        <View style={s.timelineDot} />
                        <View style={s.timelineContent}>
                          <Text style={s.timelineDate}>
                            {new Date(reg.datum).toLocaleDateString('nl-NL', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                          <Text style={s.timelineDetail}>
                            {reg.scope} · {reg.uren} uur
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={s.emptyActivity}>Nog geen activiteit</Text>
                )}

                {/* Planning taken summary */}
                {planningTaken && planningTaken.length > 0 && (
                  <View style={s.takenSummary}>
                    <Feather name="check-square" size={14} color="#888" />
                    <Text style={s.takenSummaryText}>
                      {completedTaken} / {totalTaken} taken voltooid
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Notities */}
            {offerte?.notities && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>NOTITIES</Text>
                <View style={s.card}>
                  <Text style={s.notitiesText}>{offerte.notities}</Text>
                </View>
              </View>
            )}

            {/* Bottom padding for tab bar */}
            <View style={{ height: 100 }} />
          </View>
        </ParallaxHeader>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  flex1: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  loadingBody: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    marginRight: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  errorBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: '500',
    color: '#E8E8E8',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  errorButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#0A0A0A',
    fontWeight: '500',
  },
  backOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,17,17,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Progress Section
  progressSection: {
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressNumber: {
    fontSize: 34,
    fontWeight: '700',
    color: '#4ADE80',
  },
  progressLabel: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },

  // Scope Tags Row
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 10,
    color: '#888',
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 16,
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  detailContent: {
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#E8E8E8',
  },
  detailSubText: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },

  // Team
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  teamMember: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  teamName: {
    fontSize: 11,
    color: '#E8E8E8',
    textAlign: 'center',
  },
  teamFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  teamFooterText: {
    fontSize: 12,
    color: '#888',
  },

  // Activity / Timeline
  activityHeader: {
    marginBottom: 12,
  },
  activityTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ADE80',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B8F6B',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 13,
    color: '#E8E8E8',
  },
  timelineDetail: {
    fontSize: 11,
    color: '#888',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  emptyActivity: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 16,
  },
  takenSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  takenSummaryText: {
    fontSize: 12,
    color: '#888',
  },

  // Notities
  notitiesText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
});
