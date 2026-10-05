/**
 * Home ("Vandaag", Tuinvenster): tuinbeeld van het dagdeel met de groet, de
 * Nu-kaart half eroverheen, je dag als tijdlijn, dan de werklijst en meldingen.
 * Kantoor zonder eigen planning ziet in de Nu-kaart het eerste actieve project.
 */

import { useCallback, useState, type ComponentType } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useMutation, useQuery } from 'convex/react';
import {
  Bell,
  CalendarDays,
  Camera,
  ChartColumn,
  ClipboardCheck,
  Clock,
  FileText,
  Hammer,
  Leaf,
  MapPin,
  MessageCircle,
  ShieldPlus,
  UserPlus,
} from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole } from '../../hooks/use-user-role';
import { vandaagAmsterdam, urenLabel } from '../../lib/werk-periode';
import { dagLabel, weekNummer } from '../../lib/datum-labels';
import { tekst, useColors, useTheme } from '../../theme';
import { Button, NotificationBanner, Skeleton, SkeletonCard } from '../../components/ui';
import { Drukvlak, IcoonTegel, Kaart, LijstRegel, Scheiding, StatusPil, type Toon } from '../../components/werk/Bouwstenen';
import { DagTijdlijn, TuinKop, dagItemsVan, dagdeelVan, groetVan } from '../../components/werk/Tuin';
import type { VeldDagData, VeldSegment } from '../../types/veld';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function tijdGeleden(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minuten = Math.floor(diff / 60000);
  const uren = Math.floor(diff / 3600000);
  const dagen = Math.floor(diff / 86400000);
  if (minuten < 1) return 'nu';
  if (minuten < 60) return `${minuten} min`;
  if (uren < 24) return `${uren} u`;
  if (dagen < 7) return `${dagen} d`;
  return `${Math.floor(dagen / 7)} w`;
}

function meldingIcoon(type: string): { icoon: Icoon; toon: Toon } {
  if (type.startsWith('offerte_')) return { icoon: FileText, toon: 'info' };
  if (type.startsWith('chat_')) return { icoon: MessageCircle, toon: 'primair' };
  if (type.startsWith('project_')) return { icoon: Hammer, toon: 'wachten' };
  return { icoon: Bell, toon: 'neutraal' };
}

function minuten(s: VeldSegment): number {
  const [bu, bm] = s.beginTijd.split(':').map(Number);
  const [eu, em] = s.eindTijd.split(':').map(Number);
  return Math.max(0, eu * 60 + em - (bu * 60 + bm));
}

function routeUrl(adres: string) {
  const q = encodeURIComponent(adres);
  return Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}` : `geo:0,0?q=${q}`;
}

export default function HomeScherm() {
  const { isLoading, isUserSynced } = useCurrentUser();
  const kleuren = useColors();
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ padding: 16, gap: 16 }}>
          <Skeleton width={180} height={34} />
          <Skeleton width={220} height={16} />
          <SkeletonCard lines={4} />
        </View>
      </SafeAreaView>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const kleuren = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const { isMedewerker, role } = useUserRole();
  const { user } = useCurrentUser();
  const [verversen, setVerversen] = useState(false);
  const vandaag = vandaagAmsterdam();

  const eigenDag = useQuery(api.urenSegmenten.getVeldDag, isMedewerker ? { datum: vandaag } : 'skip') as VeldDagData | null | undefined;
  const actieveProjecten = useQuery(api.projecten.getActiveProjectsWithProgress, isMedewerker ? 'skip' : {});
  const meldingen = useQuery(api.notifications.list, { limit: 5 });
  const ongelezen = useQuery(api.notifications.getUnreadCount);
  const markeerGelezen = useMutation(api.notifications.markAsRead);
  const verberg = useMutation(api.notifications.dismiss);

  // Over het tuinbeeld hoort een lichte statusbalk, ook in het lichte thema.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(isDark ? 'light' : 'dark');
  }, [isDark]));

  const voornaam = (user?.name || 'collega').split(' ')[0];
  const totaalOngelezen = ongelezen?.total || 0;
  const onRefresh = useCallback(async () => {
    setVerversen(true);
    await new Promise(r => setTimeout(r, 800));
    setVerversen(false);
  }, []);

  const kantoor = ['directie', 'projectleider'].includes(role);
  const leiding = kantoor || role === 'voorman';
  const gelogdVandaag = eigenDag ? eigenDag.segmenten.filter(s => s.categorie !== 'pauze').reduce((som, s) => som + minuten(s), 0) : 0;
  const aantalKlussen = eigenDag?.stops.length ?? 0;
  const subRegel = [
    dagLabel(vandaag),
    eigenDag?.team?.naam,
    aantalKlussen ? (aantalKlussen === 1 ? '1 klus' : `${aantalKlussen} klussen`) : null,
  ].filter(Boolean).join(' · ');

  const werk: { titel: string; sub?: string; icoon: Icoon; naar: Parameters<typeof router.push>[0] }[] = [
    { titel: 'Mijn dag', sub: eigenDag ? (eigenDag.dagStatus === 'ingediend' ? 'Ingediend' : `${urenLabel(gelogdVandaag)} geschreven`) : 'Uren schrijven', icoon: Clock, naar: '/(tabs)/uren' },
    { titel: 'Planning', sub: `Week ${weekNummer(vandaag)}`, icoon: CalendarDays, naar: '/werk/planning' },
    { titel: 'Mijn uren', sub: 'Week en maand', icoon: ChartColumn, naar: '/werk/urenoverzicht' },
    { titel: 'Protocollen', sub: 'Werk en nood', icoon: ShieldPlus, naar: '/werk/protocollen' },
    { titel: "Foto's", sub: 'Voor en na', icoon: Camera, naar: '/werk/fotos' },
    ...(leiding ? [{ titel: 'Losse krachten', sub: 'Zonder account', icoon: UserPlus, naar: '/werk/losse-krachten' as const }] : []),
    ...(kantoor ? [{ titel: 'Kantoorcontrole', sub: 'Dagen nakijken', icoon: ClipboardCheck, naar: '/werk/kantoor-uren' as const }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={verversen} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        <TuinKop
          titel={`${groetVan(dagdeelVan())}, ${voornaam}`}
          sub={subRegel}
          rechts={
            <Drukvlak
              onPress={() => router.push('/(tabs)/notifications')}
              accessibilityLabel={totaalOngelezen > 0 ? `Meldingen, ${totaalOngelezen} nieuw` : 'Meldingen'}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={20} color="#FFFFFF" strokeWidth={2} />
              {totaalOngelezen > 0 && (
                <View style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: kleuren.primary, borderWidth: 1.5, borderColor: '#FFFFFF' }} />
              )}
            </Drukvlak>
          }
        />

        {/* De eerste kaart ligt half over het tuinbeeld. */}
        <View style={{ marginTop: -36, gap: 22 }}>
          {isMedewerker ? (
            eigenDag === undefined ? <SkeletonCard lines={4} /> : <NuKaart dag={eigenDag} gelogd={gelogdVandaag} />
          ) : actieveProjecten === undefined ? (
            <SkeletonCard lines={3} />
          ) : actieveProjecten.length ? (
            <ProjectVlak projecten={actieveProjecten} />
          ) : (
            <RustigeDag titel="Geen actieve projecten" uitleg="Zodra er een project in uitvoering gaat, staat het hier." />
          )}

          {isMedewerker && eigenDag ? <JeDag dag={eigenDag} gelogd={gelogdVandaag} /> : null}

          <View style={{ gap: 10 }}>
            <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, paddingHorizontal: 2 }]}>Werk</Text>
            <Kaart padding={4} style={{ paddingHorizontal: 14 }}>
              {werk.map((w, i) => (
                <View key={w.titel}>
                  {i > 0 && <Scheiding />}
                  <LijstRegel icoon={w.icoon} toon="neutraal" titel={w.titel} sub={w.sub} onPress={() => router.push(w.naar)} />
                </View>
              ))}
            </Kaart>
          </View>

          {meldingen && meldingen.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>Meldingen</Text>
                <Drukvlak onPress={() => router.push('/(tabs)/notifications')} accessibilityLabel="Alle meldingen" hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Alle</Text>
                </Drukvlak>
              </View>
              {meldingen.slice(0, 3).map(m => {
                const { icoon, toon } = meldingIcoon(m.type);
                return (
                  <NotificationBanner
                    key={m._id}
                    icon={<IcoonTegel icoon={icoon} toon={toon} grootte={36} />}
                    title={m.title}
                    subtitle={m.message}
                    time={tijdGeleden(m._creationTime)}
                    isUnread={!m.isRead}
                    onPress={() => {
                      void markeerGelezen({ notificationId: m._id });
                      if (m.projectId) router.push(`/project/${m.projectId}`);
                    }}
                    onDismiss={() => { void verberg({ notificationId: m._id }); }}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Nu (veld) ───────────────────────────────────────────────────────────────

function NuKaart({ dag, gelogd }: { dag: VeldDagData | null; gelogd: number }) {
  const kleuren = useColors();
  const router = useRouter();
  if (dag === null) {
    return <RustigeDag titel="Account niet gekoppeld" uitleg="Je account is nog niet aan een medewerker gekoppeld. Vraag kantoor om dit te regelen." />;
  }
  if (dag.dagStatus === 'ingediend') {
    return (
      <Kaart variant="natuur" padding={18}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Vandaag</Text>
          <StatusPil label="Ingediend" toon="succes" />
        </View>
        <Text style={[tekst.grootTitel, tekst.cijfers, { color: kleuren.foreground }]}>{urenLabel(gelogd)}</Text>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: -8 }]}>geschreven en ingediend</Text>
        <Button title="Dag bekijken" variant="secondary" onPress={() => router.push('/(tabs)/uren')} fullWidth />
      </Kaart>
    );
  }
  if (!dag.stops.length) {
    return (
      <RustigeDag
        titel="Geen klussen vandaag"
        uitleg={dag.team ? `${dag.team.naam} heeft vandaag niets ingepland.` : 'Er staat vandaag niets op je planning.'}
        actie={<Button title="Planning bekijken" variant="secondary" onPress={() => router.push('/werk/planning')} />}
      />
    );
  }
  const gelogdeKlussen = dag.stops.filter(stop => dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken')).length;
  const huidige = dag.stops.find(stop => !dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken')) ?? dag.stops[0];
  const voortgang = gelogdeKlussen / dag.stops.length;
  const soort = huidige.type === 'onderhoudsbeurt' ? 'Onderhoud' : 'Aanleg';
  return (
    <Kaart variant="natuur" padding={18}>
      <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{gelogdeKlussen === dag.stops.length ? 'Alles gelogd' : gelogdeKlussen ? 'Volgende' : 'Nu'}</Text>
      <View style={{ gap: 2, marginTop: -6 }}>
        <Text style={[tekst.titel2, { color: kleuren.foreground }]} numberOfLines={2}>{huidige.klantNaam ?? huidige.naam}</Text>
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={2}>
          {[soort, huidige.adres].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: kleuren.primarySoft, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(4, Math.round(voortgang * 100))}%`, height: 4, borderRadius: 2, backgroundColor: kleuren.primary }} />
        </View>
        <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>
          {gelogdeKlussen} van {dag.stops.length} klussen gelogd · {urenLabel(huidige.geplandeMinuten)} gepland
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Mijn dag" onPress={() => router.push('/(tabs)/uren')} fullWidth /></View>
        {huidige.adres ? (
          <Drukvlak
            onPress={() => { void Linking.openURL(routeUrl(huidige.adres!)).catch(() => undefined); }}
            accessibilityLabel={`Route naar ${huidige.adres}`}
            accessibilityHint="Opent kaarten"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: kleuren.primarySoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <MapPin size={20} color={kleuren.primary} strokeWidth={2.25} />
          </Drukvlak>
        ) : null}
      </View>
    </Kaart>
  );
}

function JeDag({ dag, gelogd }: { dag: VeldDagData; gelogd: number }) {
  const kleuren = useColors();
  const items = dagItemsVan(dag, true);
  if (!items.length) return null;
  const gepland = dag.stops.reduce((som, s) => som + s.geplandeMinuten, 0);
  const rest = Math.max(0, gepland - gelogd);
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, paddingHorizontal: 2 }]}>Je dag</Text>
      <DagTijdlijn items={items} />
      <Scheiding />
      <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
        <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{urenLabel(gelogd)}</Text> geschreven{rest > 0 ? ` · nog ${urenLabel(rest)}` : ''}
      </Text>
    </View>
  );
}

// ── Kantoor: eerste actieve project ─────────────────────────────────────────

interface ProjectVoortgang { _id: string; naam: string; status: string; voortgang?: number | null; klantNaam?: string }

function ProjectVlak({ projecten }: { projecten: ProjectVoortgang[] }) {
  const kleuren = useColors();
  const router = useRouter();
  const [eerste, ...rest] = projecten;
  const voortgang = typeof eerste.voortgang === 'number' ? Math.min(100, Math.max(0, eerste.voortgang)) : null;
  return (
    <View style={{ gap: 10 }}>
      <Kaart variant="natuur" padding={18}>
        <StatusPil label="In uitvoering" toon="primair" />
        <View style={{ gap: 2 }}>
          <Text style={[tekst.titel1, { color: kleuren.foreground }]} numberOfLines={2}>{eerste.naam}</Text>
          {eerste.klantNaam ? <Text style={[tekst.callout, { color: kleuren.mutedForeground }]} numberOfLines={1}>{eerste.klantNaam}</Text> : null}
        </View>
        {voortgang !== null && (
          <View style={{ gap: 8 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: kleuren.primarySoft, overflow: 'hidden' }}>
              <View style={{ width: `${voortgang}%`, height: 6, borderRadius: 3, backgroundColor: kleuren.primary }} />
            </View>
            <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>{voortgang}% van de begrote uren</Text>
          </View>
        )}
        <Button title="Project openen" onPress={() => router.push(`/project/${eerste._id}`)} fullWidth />
      </Kaart>
      {rest.length > 0 && (
        <Kaart padding={6} style={{ paddingHorizontal: 12 }}>
          {rest.slice(0, 4).map((p, i) => (
            <View key={p._id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: kleuren.border }} />}
              <LijstRegel
                icoon={Hammer}
                toon="neutraal"
                titel={p.naam}
                sub={typeof p.voortgang === 'number' ? `${p.voortgang}% · ${p.klantNaam || p.status}` : p.klantNaam || p.status}
                onPress={() => router.push(`/project/${p._id}`)}
              />
            </View>
          ))}
        </Kaart>
      )}
    </View>
  );
}

function RustigeDag({ titel, uitleg, actie }: { titel: string; uitleg: string; actie?: React.ReactNode }) {
  const kleuren = useColors();
  return (
    <Kaart padding={18} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <IcoonTegel icoon={Leaf} toon="primair" grootte={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tekst.titel3, { color: kleuren.foreground }]}>{titel}</Text>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{uitleg}</Text>
        </View>
      </View>
      {actie}
    </Kaart>
  );
}
