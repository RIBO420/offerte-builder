import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEenmaligePush } from '../../hooks/use-eenmalige-push';
import { useQuery } from 'convex/react';
import { MessageCircle, SquarePen } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import { tekst } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { OfflineIndicator } from '../../components/ui';
import { Drukvlak, Kaart, LegeStaat, SectieKop } from '../../components/werk/Bouwstenen';
import { BuitenModusProvider, useVeldKleuren } from '../../components/veld/BuitenModus';
import { GesprekRegel, RegelLijn } from '../../components/chat/GesprekRegel';
import { GesprekAvatar, gesprekHref, VASTE_NAMEN } from '../../components/chat/gesprekken';
import { NieuwBerichtBlad, type DMKandidaat } from '../../components/chat/NieuwBerichtBlad';
import { voornaam } from '../../components/chat/chat-tijd';

/**
 * Chat-tab: een inbox van gesprekken, zoals Berichten. Teamchat en Mededelingen
 * staan altijd bovenaan; daaronder de privégesprekken en de projectchats met
 * berichten (alleen-lezen historie). Tikken opent het gesprek als eigen scherm
 * (app/chat/[soort].tsx) met native kop en terug-veeg.
 */
export default function ChatScreen() {
  const { user, isLoading, isUserSynced } = useCurrentUser();
  const kleuren = useVeldKleuren();

  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={kleuren.primary} />
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BuitenModusProvider userId={user?._id ? String(user._id) : null}>
      <ChatInbox />
    </BuitenModusProvider>
  );
}

/** Eén regel tekst uit een bericht: witruimte en regeleinden plat. */
function plat(bericht: string): string {
  return bericht.replace(/\s+/g, ' ').trim();
}

interface ProjectGesprek {
  id: string;
  naam: string;
  laatste: Doc<'team_messages'>;
  ongelezen: number;
}

function ChatInbox() {
  const kleuren = useVeldKleuren();
  const router = useRouter();
  const pushEenmalig = useEenmaligePush();
  const params = useLocalSearchParams<{ dm?: string; project?: string }>();
  const { user, role } = useCurrentUser();
  const [verversen, setVerversen] = useState(false);
  const [bladOpen, setBladOpen] = useState(false);
  const naSluitenDoel = useRef<ReturnType<typeof gesprekHref> | null>(null);

  // Laatste bericht per vast kanaal; de ongelezen-tellingen komen uit getUnreadCounts.
  const team = useQuery(api.chat.getTeamMessages, { channelType: 'team', limit: 1 });
  const mededelingen = useQuery(api.chat.getTeamMessages, { channelType: 'broadcast', limit: 1 });
  // Projectchats: recente berichten per project gegroepeerd. Alleen projecten mét
  // berichten verschijnen; het kanaal is alleen-lezen, een leeg project zegt niets.
  const projectBerichten = useQuery(api.chat.getTeamMessages, { channelType: 'project', limit: 200 });
  const kanalen = useQuery(api.chat.getChannels);
  const dms = useQuery(api.chat.getDMConversations);
  const ongelezen = useQuery(api.chat.getUnreadCounts);

  const mijnId = user?._id;
  const mijnClerkId = user?.clerkId;
  const kantoor = isKantoorRole(role);

  const projecten = useMemo<ProjectGesprek[] | undefined>(() => {
    if (!projectBerichten) return undefined;
    // Zelfde zichtbaarheid als de server (getChannels): het veld ziet alleen
    // projecten waaraan het is toegewezen; kantoor ziet alles, ook gearchiveerd.
    const toegestaan = new Map<string, string>();
    for (const k of kanalen ?? []) {
      if (k.type === 'project' && k.projectId) toegestaan.set(String(k.projectId), k.name);
    }
    const groepen = new Map<string, ProjectGesprek>();
    for (const m of projectBerichten) {
      if (!m.projectId) continue;
      const pid = String(m.projectId);
      if (!kantoor && !toegestaan.has(pid)) continue;
      const groep = groepen.get(pid) ?? { id: pid, naam: toegestaan.get(pid) ?? m.channelName, laatste: m, ongelezen: 0 };
      groep.laatste = m; // oplopend geleverd: de laatste wint
      if (m.senderId !== mijnId && mijnClerkId && !(m.readBy ?? []).includes(mijnClerkId)) groep.ongelezen++;
      groepen.set(pid, groep);
    }
    return [...groepen.values()].sort((a, b) => b.laatste.createdAt - a.laatste.createdAt);
  }, [projectBerichten, kanalen, kantoor, mijnId, mijnClerkId]);

  const totaalOngelezen =
    ongelezen === undefined
      ? undefined
      : ongelezen.team + ongelezen.broadcast + ongelezen.dm + (projecten ?? []).reduce((som, p) => som + p.ongelezen, 0);

  const kanaalVoorbeeld = useCallback(
    (m: Doc<'team_messages'> | undefined, leeg: string) => {
      if (!m) return leeg;
      return `${m.senderId === mijnId ? 'Jij' : voornaam(m.senderName)}: ${plat(m.message)}`;
    },
    [mijnId]
  );

  // Deeplinks uit pushmeldingen: /(tabs)/chat?project=<id> of ?dm=<users-id>.
  useEffect(() => {
    if (params.project) {
      router.push(gesprekHref('project', undefined, params.project));
      router.setParams({ project: undefined });
    } else if (params.dm) {
      router.push(gesprekHref('dm', undefined, params.dm));
      router.setParams({ dm: undefined });
    }
  }, [params.project, params.dm, router]);

  const onRefresh = useCallback(async () => {
    setVerversen(true);
    // Convex-queries verversen zelf; dit geeft alleen de vertrouwde trek-beweging.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setVerversen(false);
  }, []);

  const kiesCollega = useCallback(
    (k: DMKandidaat) => {
      const doel = gesprekHref('dm', k.naam, String(k.userId));
      if (Platform.OS === 'ios') {
        // Pas navigeren als het blad weg is; tegelijk duwen en sluiten hapert op iOS.
        naSluitenDoel.current = doel;
        setBladOpen(false);
      } else {
        setBladOpen(false);
        router.push(doel);
      }
    },
    [router]
  );

  const naSluiten = useCallback(() => {
    const doel = naSluitenDoel.current;
    naSluitenDoel.current = null;
    if (doel) router.push(doel);
  }, [router]);

  const ondertitel =
    totaalOngelezen === undefined ? 'Top Tuinen' : totaalOngelezen > 0 ? `${totaalOngelezen} ongelezen` : 'Alles gelezen';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <OfflineIndicator style={{ marginHorizontal: 16 }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={verversen} onRefresh={onRefresh} tintColor={kleuren.primary} />}
      >
        {/* Kop: grote titel, stand van zaken, nieuw bericht */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]} numberOfLines={1}>
              Chat
            </Text>
            <Text style={[tekst.sub, tekst.cijfers, { color: totaalOngelezen ? kleuren.primary : kleuren.mutedForeground, marginTop: 2, fontWeight: totaalOngelezen ? '600' : '400' }]}>
              {ondertitel}
            </Text>
          </View>
          <Drukvlak
            onPress={() => setBladOpen(true)}
            accessibilityLabel="Nieuw bericht"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.vulling, alignItems: 'center', justifyContent: 'center' }}
          >
            <SquarePen size={20} color={kleuren.foreground} strokeWidth={2} />
          </Drukvlak>
        </View>

        <SectieKop titel="Team" />
        <Kaart padding={0} style={{ paddingHorizontal: 16, gap: 0 }}>
          <GesprekRegel
            avatar={<GesprekAvatar soort="team" naam={VASTE_NAMEN.team} />}
            naam={VASTE_NAMEN.team}
            voorbeeld={team === undefined ? 'Laden…' : kanaalVoorbeeld(team[team.length - 1], 'Nog geen berichten')}
            tijd={team?.[team.length - 1]?.createdAt}
            ongelezen={ongelezen?.team ?? 0}
            onPress={() => pushEenmalig(gesprekHref('team', VASTE_NAMEN.team))}
          />
          <RegelLijn />
          <GesprekRegel
            avatar={<GesprekAvatar soort="mededelingen" naam={VASTE_NAMEN.mededelingen} />}
            naam={VASTE_NAMEN.mededelingen}
            voorbeeld={mededelingen === undefined ? 'Laden…' : kanaalVoorbeeld(mededelingen[mededelingen.length - 1], 'Nog geen mededelingen')}
            tijd={mededelingen?.[mededelingen.length - 1]?.createdAt}
            ongelezen={ongelezen?.broadcast ?? 0}
            onPress={() => pushEenmalig(gesprekHref('mededelingen', VASTE_NAMEN.mededelingen))}
          />
        </Kaart>

        <SectieKop titel="Direct" />
        {dms === undefined ? (
          <Kaart style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={kleuren.primary} accessibilityLabel="Gesprekken laden" />
          </Kaart>
        ) : dms.length === 0 ? (
          <LegeStaat
            icoon={MessageCircle}
            titel="Nog geen gesprekken"
            uitleg="Een privégesprek met een collega verschijnt hier."
            actie={
              <Drukvlak
                onPress={() => setBladOpen(true)}
                accessibilityLabel="Nieuw bericht"
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 22, backgroundColor: kleuren.primarySoft }}
              >
                <SquarePen size={17} color={kleuren.primary} strokeWidth={2.25} />
                <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Nieuw bericht</Text>
              </Drukvlak>
            }
          />
        ) : (
          <Kaart padding={0} style={{ paddingHorizontal: 16, gap: 0 }}>
            {dms.map((g, i) => (
              <View key={g.partnerId}>
                {i > 0 && <RegelLijn />}
                <GesprekRegel
                  avatar={<GesprekAvatar soort="dm" naam={g.partnerName} />}
                  naam={g.partnerName}
                  voorbeeld={plat(g.lastMessage) || 'Nog geen berichten'}
                  tijd={g.lastMessageAt}
                  ongelezen={g.unreadCount}
                  onPress={() => pushEenmalig(gesprekHref('dm', g.partnerName, String(g.partnerId)))}
                />
              </View>
            ))}
          </Kaart>
        )}

        {projecten && projecten.length > 0 && (
          <>
            <SectieKop titel="Projecten" rechts={<Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>Alleen lezen</Text>} />
            <Kaart padding={0} style={{ paddingHorizontal: 16, gap: 0 }}>
              {projecten.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <RegelLijn />}
                  <GesprekRegel
                    avatar={<GesprekAvatar soort="project" naam={p.naam} />}
                    naam={p.naam}
                    voorbeeld={kanaalVoorbeeld(p.laatste, '')}
                    tijd={p.laatste.createdAt}
                    ongelezen={p.ongelezen}
                    onPress={() => pushEenmalig(gesprekHref('project', p.naam, p.id))}
                  />
                </View>
              ))}
            </Kaart>
          </>
        )}
      </ScrollView>

      <NieuwBerichtBlad zichtbaar={bladOpen} onSluit={() => setBladOpen(false)} onKies={kiesCollega} onNaSluiten={naSluiten} />
    </SafeAreaView>
  );
}
