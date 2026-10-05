/**
 * Home — "jouw dag". Bovenaan wat er vandaag speelt (het natuurvlak), daaronder
 * de werktegels met live status, dan meldingen. Voor kantoor zonder eigen
 * planning toont het natuurvlak het eerste actieve project.
 */

import { useCallback, useState, type ComponentType } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  Navigation,
  ShieldPlus,
  UserPlus,
} from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole } from '../../hooks/use-user-role';
import { vandaagAmsterdam, urenLabel } from '../../lib/werk-periode';
import { dagLabel, weekNummer } from '../../lib/datum-labels';
import { tekst, useColors } from '../../theme';
import { Button, NotificationBanner, Skeleton, SkeletonCard } from '../../components/ui';
import { Drukvlak, IcoonTegel, Kaart, LijstRegel, SectieKop, StatusPil, type Toon } from '../../components/werk/Bouwstenen';
import type { VeldDagData, VeldSegment, VeldStop } from '../../types/veld';

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

  const tegels: { titel: string; sub: string; icoon: Icoon; toon: Toon; naar: Parameters<typeof router.push>[0] }[] = [
    {
      titel: 'Mijn dag',
      sub: eigenDag ? (eigenDag.dagStatus === 'ingediend' ? 'Ingediend' : `${urenLabel(gelogdVandaag)} vandaag`) : 'Uren schrijven',
      icoon: Clock,
      toon: eigenDag?.dagStatus === 'ingediend' ? 'succes' : 'primair',
      naar: '/(tabs)/uren',
    },
    { titel: 'Planning', sub: `Week ${weekNummer(vandaag)}`, icoon: CalendarDays, toon: 'info', naar: '/werk/planning' },
    { titel: 'Mijn uren', sub: 'Week en maand', icoon: ChartColumn, toon: 'primair', naar: '/werk/urenoverzicht' },
    { titel: 'Protocollen', sub: 'Werk en nood', icoon: ShieldPlus, toon: 'gemist', naar: '/werk/protocollen' },
    { titel: "Foto's", sub: 'Voor en na', icoon: Camera, toon: 'neutraal', naar: '/werk/fotos' },
    ...(leiding ? [{ titel: 'Losse krachten', sub: 'Zonder account', icoon: UserPlus, toon: 'wachten' as Toon, naar: '/werk/losse-krachten' as const }] : []),
    ...(kantoor ? [{ titel: 'Kantoorcontrole', sub: 'Dagen nakijken', icoon: ClipboardCheck, toon: 'info' as Toon, naar: '/werk/kantoor-uren' as const }] : []),
  ];
  const rijen: (typeof tegels)[] = [];
  for (let i = 0; i < tegels.length; i += 2) rijen.push(tegels.slice(i, i + 2));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={verversen} onRefresh={onRefresh} tintColor={kleuren.primary} />}
      >
        {/* Kop */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]} numberOfLines={1}>Hoi {voornaam}</Text>
            <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
              {dagLabel(vandaag)}{eigenDag?.team ? ` · ${eigenDag.team.naam}` : ''}
            </Text>
          </View>
          <Drukvlak
            onPress={() => router.push('/(tabs)/notifications')}
            accessibilityLabel={totaalOngelezen > 0 ? `Meldingen, ${totaalOngelezen} nieuw` : 'Meldingen'}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={21} color={kleuren.foreground} strokeWidth={2} />
            {totaalOngelezen > 0 && (
              <View style={{ position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: kleuren.primary, borderWidth: 2, borderColor: kleuren.muted }} />
            )}
          </Drukvlak>
        </View>

        {/* Vandaag */}
        {isMedewerker ? (
          eigenDag === undefined ? <SkeletonCard lines={4} /> : <VandaagVlak dag={eigenDag} gelogd={gelogdVandaag} />
        ) : actieveProjecten === undefined ? (
          <SkeletonCard lines={3} />
        ) : actieveProjecten.length ? (
          <ProjectVlak projecten={actieveProjecten} />
        ) : (
          <RustigeDag titel="Geen actieve projecten" uitleg="Zodra er een project in uitvoering gaat, staat het hier." />
        )}

        {/* Werktegels */}
        <SectieKop titel="Werk" />
        <View style={{ gap: 10 }}>
          {rijen.map((rij, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              {rij.map(t => (
                <Drukvlak
                  key={t.titel}
                  onPress={() => router.push(t.naar)}
                  accessibilityLabel={`${t.titel}, ${t.sub}`}
                  buitenStijl={{ flex: 1 }}
                  style={{ backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, gap: 10, minHeight: 68, flexDirection: 'row', alignItems: 'center' }}
                >
                  <IcoonTegel icoon={t.icoon} toon={t.toon} grootte={38} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground, fontSize: 16 }]} numberOfLines={1}>{t.titel}</Text>
                    <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]} numberOfLines={1}>{t.sub}</Text>
                  </View>
                </Drukvlak>
              ))}
              {rij.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>

        {/* Meldingen */}
        <SectieKop
          titel="Meldingen"
          telling={totaalOngelezen}
          rechts={meldingen && meldingen.length > 0 ? (
            <Drukvlak onPress={() => router.push('/(tabs)/notifications')} accessibilityLabel="Alle meldingen" style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Alle</Text>
            </Drukvlak>
          ) : undefined}
        />
        {meldingen === undefined ? (
          <SkeletonCard lines={1} />
        ) : meldingen.length ? (
          <View style={{ gap: 8 }}>
            {meldingen.slice(0, 5).map(m => {
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
        ) : (
          <Text style={[tekst.sub, { color: kleuren.mutedForeground, paddingHorizontal: 4 }]}>Geen nieuwe meldingen.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Vandaag (veld) ──────────────────────────────────────────────────────────

function VandaagVlak({ dag, gelogd }: { dag: VeldDagData | null; gelogd: number }) {
  const kleuren = useColors();
  const router = useRouter();
  if (dag === null) {
    return <RustigeDag titel="Account niet gekoppeld" uitleg="Je account is nog niet aan een medewerker gekoppeld. Vraag kantoor om dit te regelen." />;
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
  const eerste = dag.stops.find(stop => !dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken')) ?? dag.stops[0];
  const overige = dag.stops.filter(stop => stop !== eerste);
  const voortgang = dag.stops.length ? gelogdeKlussen / dag.stops.length : 0;
  const ingediend = dag.dagStatus === 'ingediend';

  return (
    <View style={{ gap: 10 }}>
      <Kaart variant="natuur" padding={18}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <StatusPil label={ingediend ? 'Dag ingediend' : gelogdeKlussen === dag.stops.length ? 'Alles gelogd' : 'Vandaag'} toon={ingediend || gelogdeKlussen === dag.stops.length ? 'succes' : 'primair'} />
          <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>
            {dag.stops.length === 1 ? '1 klus' : `${dag.stops.length} klussen`} · {urenLabel(dag.stops.reduce((s, k) => s + k.geplandeMinuten, 0))}
          </Text>
        </View>
        <KlusKop stop={eerste} />
        <View style={{ gap: 8 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: kleuren.primarySoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(voortgang * 100)}%`, height: 6, borderRadius: 3, backgroundColor: kleuren.primary }} />
          </View>
          <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>
            {gelogdeKlussen} van {dag.stops.length} gelogd · {urenLabel(gelogd)} geschreven
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Button title={ingediend ? 'Dag bekijken' : 'Mijn dag openen'} onPress={() => router.push('/(tabs)/uren')} fullWidth /></View>
          <Button variant="secondary" size="icon" onPress={() => router.push('/werk/fotos')} icon={<Camera size={20} color={kleuren.primary} strokeWidth={2} />} title={undefined} />
        </View>
      </Kaart>
      {overige.length > 0 && (
        <Kaart padding={6} style={{ paddingHorizontal: 12 }}>
          {overige.map((stop, i) => (
            <View key={String(stop.werkitemId)}>
              {i > 0 && <View style={{ height: 1, backgroundColor: kleuren.border }} />}
              <LijstRegel
                icoon={MapPin}
                toon="neutraal"
                titel={stop.klantNaam ?? stop.naam}
                sub={`${stop.adres ?? stop.naam} · ${urenLabel(stop.geplandeMinuten)}`}
                onPress={() => router.push('/werk/planning')}
              />
            </View>
          ))}
        </Kaart>
      )}
    </View>
  );
}

function KlusKop({ stop }: { stop: VeldStop }) {
  const kleuren = useColors();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ gap: 2 }}>
        <Text style={[tekst.titel1, { color: kleuren.foreground }]} numberOfLines={2}>{stop.klantNaam ?? stop.naam}</Text>
        {stop.klantNaam && <Text style={[tekst.callout, { color: kleuren.mutedForeground }]} numberOfLines={1}>{stop.naam}</Text>}
      </View>
      {stop.adres && (
        <Drukvlak
          onPress={() => { void Linking.openURL(routeUrl(stop.adres!)).catch(() => undefined); }}
          accessibilityLabel={`Route naar ${stop.adres}`}
          accessibilityHint="Opent kaarten"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}
        >
          <Navigation size={16} color={kleuren.primary} strokeWidth={2.25} />
          <Text style={[tekst.sub, { color: kleuren.foreground, flex: 1 }]} numberOfLines={1}>{stop.adres}</Text>
        </Drukvlak>
      )}
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
