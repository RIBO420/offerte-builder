import { useCurrentUser } from '../../hooks/use-current-user';
import { isInternalRole } from '../../lib/roles';
import { GeenToegang } from '../../components/GeenToegang';
import React, { type ComponentType, type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, CircleAlert, Clock, Flag, MapPin, Phone, SquareCheck } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { tekst } from '../../theme';
import {
  Button,
  ParallaxHeader,
  AnimatedNumber,
  ScopeTag,
  Skeleton,
} from '../../components/ui';
import { Drukvlak, IcoonTegel, Kaart, LegeStaat, SectieKop, Scheiding, StatusPil, type Toon } from '../../components/werk/Bouwstenen';
import { useVeldKleuren } from '../../components/veld/BuitenModus';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Projectstatus → pil
const STATUS_PIL: Record<string, { label: string; toon: Toon }> = {
  gepland: { label: 'Gepland', toon: 'wachten' },
  in_uitvoering: { label: 'In uitvoering', toon: 'primair' },
  afgerond: { label: 'Afgerond', toon: 'info' },
  on_hold: { label: 'On hold', toon: 'neutraal' },
};

function statusPil(status: string): { label: string; toon: Toon } {
  if (STATUS_PIL[status]) return STATUS_PIL[status];
  const label = status.replace('_', ' ');
  return { label: label.charAt(0).toUpperCase() + label.slice(1), toon: 'wachten' };
}

const datumLang = (datum: string | number) =>
  new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ProjectDetailScreen() {
  const { role, isLoading } = useCurrentUser();
  const kleuren = useVeldKleuren();
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: kleuren.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Project laden…</Text>
      </View>
    );
  }
  if (!isInternalRole(role)) return <GeenToegang uitleg="Dit projectscherm is alleen voor medewerkers. Gebruik als klant het klantportaal." />;
  return <ProjectDetailContent />;
}

/** Ronde terugknop; op een vast vlak zodat hij leesbaar blijft boven elke kop. */
function TerugKnop({ onPress }: { onPress: () => void }) {
  const kleuren = useVeldKleuren();
  return (
    <Drukvlak
      onPress={onPress}
      accessibilityLabel="Terug"
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <ChevronLeft size={24} color={kleuren.foreground} strokeWidth={2.25} />
    </Drukvlak>
  );
}

/** Detailregel: icoon, klein label en de waarde. */
function DetailRegel({ icoon: I, label, waarde, sub, nadruk }: { icoon: Icoon; label?: string; waarde: string; sub?: string; nadruk?: boolean }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 }}>
      <View style={{ paddingTop: 2 }}>
        <I size={18} color={kleuren.mutedForeground} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        {label && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>{label}</Text>}
        <Text style={[tekst.callout, tekst.cijfers, { color: nadruk ? kleuren.primary : kleuren.foreground, fontWeight: nadruk ? '600' : '400' }]}>{waarde}</Text>
        {sub && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>{sub}</Text>}
      </View>
    </View>
  );
}

function Sectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <SectieKop titel={titel} />
      <Kaart>{children}</Kaart>
    </View>
  );
}

function ProjectDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const kleuren = useVeldKleuren();
  const insets = useSafeAreaInsets();

  const projectData = useQuery(
    api.mobile.getProjectDetailsForMedewerker,
    id ? { projectId: id as Id<'projecten'> } : 'skip'
  );

  if (!id) {
    return (
      <View style={{ flex: 1, backgroundColor: kleuren.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Geen project ID</Text>
      </View>
    );
  }

  if (projectData === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <TerugKnop onPress={() => router.back()} />
          <Skeleton width={200} height={24} />
        </View>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Skeleton width="100%" height={150} borderRadius={18} />
          <Skeleton width="100%" height={200} borderRadius={18} />
          <Skeleton width="100%" height={150} borderRadius={18} />
        </View>
      </SafeAreaView>
    );
  }

  if ('error' in projectData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <TerugKnop onPress={() => router.back()} />
          <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>Fout</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
          <LegeStaat
            icoon={CircleAlert}
            titel="Geen toegang"
            uitleg={typeof projectData.error === 'string' ? projectData.error : 'Dit project is niet beschikbaar.'}
            actie={<Button title="Terug" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { project, offerte, voorcalculatie, planningTaken } = projectData;
  const medewerkerUren = { registraties: projectData.mijnUrenRegistraties, totaalUren: projectData.totaalUren };
  const status = statusPil(project.status);

  // Calculate progress from planning tasks
  const totalTaken = planningTaken?.length || 0;
  const completedTaken = planningTaken?.filter((t: { status: string }) => t.status === 'completed').length || 0;
  const progressPercent = totalTaken > 0 ? Math.round((completedTaken / totalTaken) * 100) : 0;

  // Build subtitle from scopes or description
  const subtitleText = offerte?.scopes
    ? offerte.scopes.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')
    : project.status.replace('_', ' ');

  const detailRegels: ReactNode[] = [];
  if (offerte?.klant?.adres) {
    detailRegels.push(
      <DetailRegel key="adres" icoon={MapPin} waarde={offerte.klant.adres} sub={`${offerte.klant.postcode} ${offerte.klant.plaats}`} />
    );
  }
  if (project.startDatum) {
    detailRegels.push(<DetailRegel key="start" icoon={Calendar} label="Startdatum" waarde={datumLang(project.startDatum)} />);
  }
  if (project.deadline) {
    detailRegels.push(<DetailRegel key="deadline" icoon={Flag} label="Deadline" waarde={datumLang(project.deadline)} />);
  }
  if (offerte?.klant?.telefoon) {
    detailRegels.push(<DetailRegel key="telefoon" icoon={Phone} label="Telefoon" waarde={offerte.klant.telefoon} nadruk />);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      {/* Terugknop boven de kop */}
      <View style={{ position: 'absolute', top: insets.top + 6, left: 16, zIndex: 10 }}>
        <TerugKnop onPress={() => router.back()} />
      </View>

      <ParallaxHeader
        title={project.naam}
        subtitle={subtitleText}
        height={200}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 14 }}>
          {/* Voortgang */}
          <Kaart>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <AnimatedNumber
                  value={progressPercent}
                  suffix="%"
                  style={[tekst.titel1, tekst.cijfers, { color: kleuren.primary }]}
                />
                <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>voltooid</Text>
              </View>
              <StatusPil label={status.label} toon={status.toon} />
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: kleuren.primarySoft, overflow: 'hidden' }}>
              <View style={{ width: `${progressPercent}%`, height: 6, borderRadius: 3, backgroundColor: kleuren.primary }} />
            </View>

            {/* Scope Tags Row */}
            {offerte?.scopes && offerte.scopes.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {offerte.scopes.map((scope: string) => (
                  <ScopeTag
                    key={scope}
                    scope={scope as any}
                    size="sm"
                  />
                ))}
              </View>
            )}
          </Kaart>

          {/* Quick Actions Row
              Alleen "Uren" is hier zinvol. "Foto's" verwees naar een scherm dat niet
              bestaat (de Foto's-tab is een stub, zie docs/MOBILE-AUDIT.md B5) en
              "Notities" dupliceerde de NOTITIES-sectie die hieronder al zichtbaar is.
              Beide hadden geen onPress en deden dus niets. */}
          <Drukvlak
            onPress={() => router.push('/(tabs)/uren')}
            accessibilityLabel="Uren schrijven"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border }}
          >
            <IcoonTegel icoon={Clock} toon="primair" grootte={38} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[tekst.kop, { color: kleuren.foreground }]}>Uren</Text>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>Naar mijn dag</Text>
            </View>
            <ChevronRight size={18} color={kleuren.mutedForeground} strokeWidth={2} />
          </Drukvlak>

          {/* Details */}
          {detailRegels.length > 0 && (
            <Sectie titel="Details">
              <View>
                {detailRegels.map((regel, index) => (
                  <View key={index}>
                    {index > 0 && <Scheiding />}
                    {regel}
                  </View>
                ))}
              </View>
            </Sectie>
          )}

          {/* Team */}
          {voorcalculatie && (
            <Sectie titel="Team">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {(voorcalculatie.teamleden ?? []).map((naam: string, index: number) => (
                  <View key={index} style={{ alignItems: 'center', gap: 6, width: 68 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={[tekst.kop, { color: kleuren.primary }]}>{naam.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[tekst.bijschrift, { color: kleuren.foreground, textAlign: 'center' }]} numberOfLines={1}>{naam}</Text>
                  </View>
                ))}
              </View>
              {voorcalculatie.geschatteDagen && (
                <>
                  <Scheiding />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color={kleuren.mutedForeground} strokeWidth={2} />
                    <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                      Geschatte duur: {voorcalculatie.geschatteDagen} dagen
                    </Text>
                  </View>
                </>
              )}
            </Sectie>
          )}

          {/* Activiteit */}
          <Sectie titel="Activiteit">
            {/* Recent uren registraties as timeline */}
            {medewerkerUren.totaalUren === null || medewerkerUren.registraties.length > 0 ? (
              <View>
                <Text style={[tekst.kop, tekst.cijfers, { color: kleuren.primary, marginBottom: 4 }]}>
                  {medewerkerUren.totaalUren === null ? 'Urenbron kiezen door kantoor' : `${medewerkerUren.totaalUren.toFixed(1)} uur totaal`}
                </Text>
                {medewerkerUren.registraties.slice(0, 5).map((reg: { datum: string; scope?: string; uren: number }, index: number) => (
                  <View key={index}>
                    {index > 0 && <Scheiding />}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kleuren.primary, marginTop: 7 }} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[tekst.callout, tekst.cijfers, { color: kleuren.foreground }]}>
                          {new Date(reg.datum).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                        <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, textTransform: 'capitalize' }]}>
                          {reg.scope} · {reg.uren} uur
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center', paddingVertical: 12 }]}>Nog geen activiteit</Text>
            )}

            {/* Planning taken summary */}
            {planningTaken && planningTaken.length > 0 && (
              <>
                <Scheiding />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SquareCheck size={16} color={kleuren.mutedForeground} strokeWidth={2} />
                  <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                    {completedTaken} / {totalTaken} taken voltooid
                  </Text>
                </View>
              </>
            )}
          </Sectie>

          {/* Notities */}
          {offerte?.notities && (
            <Sectie titel="Notities">
              <Text style={[tekst.callout, { color: kleuren.foreground }]}>{offerte.notities}</Text>
            </Sectie>
          )}

          {/* Ruimte onderaan */}
          <View style={{ height: 100 }} />
        </View>
      </ParallaxHeader>
    </SafeAreaView>
  );
}
