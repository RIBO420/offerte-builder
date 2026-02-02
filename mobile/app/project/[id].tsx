import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useColors } from '../../theme';
import { Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '../../components/ui';
import { cn } from '../../lib/utils';

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  gepland: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
  in_uitvoering: { bg: 'bg-green-500/20', text: 'text-green-500' },
  afgerond: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  on_hold: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
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
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Geen project ID</Text>
      </View>
    );
  }

  if (projectData === undefined) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Skeleton width={200} height={24} />
          </View>
          <ScrollView className="flex-1 p-4">
            <Skeleton width="100%" height={150} className="rounded-2xl mb-3" />
            <Skeleton width="100%" height={200} className="rounded-2xl mb-3" />
            <Skeleton width="100%" height={150} className="rounded-2xl" />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if ('error' in projectData) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">Fout</Text>
          </View>
          <View className="flex-1 items-center justify-center p-4">
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text className="text-lg font-medium text-foreground mt-4">
              Geen toegang
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-2">
              {projectData.error}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-6 px-6 py-3 bg-primary rounded-lg"
            >
              <Text className="text-primary-foreground font-medium">Terug</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { project, offerte, voorcalculatie, planningTaken, medewerkerUren } = projectData;
  const statusColor = STATUS_COLORS[project.status] || STATUS_COLORS.gepland;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {project.naam}
            </Text>
          </View>
          <View className={cn('px-2 py-1 rounded-full', statusColor.bg)}>
            <Text className={cn('text-xs font-medium capitalize', statusColor.text)}>
              {project.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Klant Info */}
          {offerte && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center gap-2">
                  <Feather name="user" size={18} color={colors.primary} />
                  <CardTitle>Klant</CardTitle>
                </View>
              </CardHeader>
              <CardContent>
                <Text className="text-base font-medium text-foreground">
                  {offerte.klant.naam}
                </Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  {offerte.klant.adres}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {offerte.klant.postcode} {offerte.klant.plaats}
                </Text>
                {offerte.klant.telefoon && (
                  <TouchableOpacity className="flex-row items-center gap-2 mt-3">
                    <Feather name="phone" size={16} color={colors.accent} />
                    <Text className="text-sm text-accent">{offerte.klant.telefoon}</Text>
                  </TouchableOpacity>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scopes */}
          {offerte?.scopes && offerte.scopes.length > 0 && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center gap-2">
                  <Feather name="layers" size={18} color={colors.primary} />
                  <CardTitle>Werkzaamheden</CardTitle>
                </View>
              </CardHeader>
              <CardContent>
                <View className="flex-row flex-wrap gap-2">
                  {offerte.scopes.map((scope) => (
                    <View
                      key={scope}
                      className="px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: `${SCOPE_COLORS[scope] || colors.muted}20` }}
                    >
                      <Text
                        className="text-sm font-medium capitalize"
                        style={{ color: SCOPE_COLORS[scope] || colors.foreground }}
                      >
                        {scope}
                      </Text>
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* Team */}
          {voorcalculatie && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Feather name="users" size={18} color={colors.primary} />
                    <CardTitle>Team</CardTitle>
                  </View>
                  <Badge variant="secondary">{voorcalculatie.teamGrootte} personen</Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View className="flex-row flex-wrap gap-2">
                  {voorcalculatie.teamleden.map((naam, index) => (
                    <View
                      key={index}
                      className="flex-row items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg"
                    >
                      <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                        <Text className="text-sm font-semibold text-primary-foreground">
                          {naam.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-sm text-foreground">{naam}</Text>
                    </View>
                  ))}
                </View>
                {voorcalculatie.geschatteDagen && (
                  <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Feather name="calendar" size={16} color={colors.mutedForeground} />
                    <Text className="text-sm text-muted-foreground">
                      Geschatte duur: {voorcalculatie.geschatteDagen} dagen
                    </Text>
                  </View>
                )}
              </CardContent>
            </Card>
          )}

          {/* Planning Taken */}
          {planningTaken && planningTaken.length > 0 && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center gap-2">
                  <Feather name="check-square" size={18} color={colors.primary} />
                  <CardTitle>Taken ({planningTaken.length})</CardTitle>
                </View>
              </CardHeader>
              <CardContent>
                {planningTaken.map((taak, index) => (
                  <View
                    key={taak._id}
                    className={cn(
                      'flex-row items-center py-3',
                      index < planningTaken.length - 1 && 'border-b border-border'
                    )}
                  >
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                      style={{ backgroundColor: `${SCOPE_COLORS[taak.scope] || colors.muted}20` }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: SCOPE_COLORS[taak.scope] || colors.foreground }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">
                        {taak.taakNaam}
                      </Text>
                      <Text className="text-xs text-muted-foreground capitalize">
                        {taak.scope} • {taak.normUren} uur
                      </Text>
                    </View>
                    {taak.status === 'completed' && (
                      <Feather name="check-circle" size={18} color={colors.success} />
                    )}
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mijn Uren */}
          {medewerkerUren && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Feather name="clock" size={18} color={colors.primary} />
                    <CardTitle>Mijn Uren</CardTitle>
                  </View>
                  <Text className="text-lg font-bold text-accent">
                    {medewerkerUren.totaalUren.toFixed(1)} uur
                  </Text>
                </View>
              </CardHeader>
              {medewerkerUren.registraties.length > 0 ? (
                <CardContent>
                  {medewerkerUren.registraties.slice(0, 5).map((reg, index) => (
                    <View
                      key={index}
                      className={cn(
                        'flex-row items-center justify-between py-2',
                        index < Math.min(medewerkerUren.registraties.length, 5) - 1 && 'border-b border-border'
                      )}
                    >
                      <View>
                        <Text className="text-sm text-foreground">
                          {new Date(reg.datum).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                        <Text className="text-xs text-muted-foreground capitalize">
                          {reg.scope}
                        </Text>
                      </View>
                      <Text className="text-sm font-medium text-foreground">
                        {reg.uren} uur
                      </Text>
                    </View>
                  ))}
                </CardContent>
              ) : (
                <CardContent>
                  <Text className="text-sm text-muted-foreground text-center py-4">
                    Nog geen uren geregistreerd
                  </Text>
                </CardContent>
              )}
            </Card>
          )}

          {/* Notities */}
          {offerte?.notities && (
            <Card variant="glass" className="mb-3">
              <CardHeader>
                <View className="flex-row items-center gap-2">
                  <Feather name="file-text" size={18} color={colors.primary} />
                  <CardTitle>Notities</CardTitle>
                </View>
              </CardHeader>
              <CardContent>
                <Text className="text-sm text-muted-foreground">
                  {offerte.notities}
                </Text>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
