/**
 * Mijn dag — de veld-rol in de mobile-app (PRD §2.6, stap 9b).
 *
 * Vervangt de oude klok-in/klok-uit-flow (api.mobile.*): de werkdag bestaat
 * nu uit urensegmenten die vanuit de dagkaart worden voorgesteld en door de
 * medewerker worden bevestigd of gecorrigeerd — loggen wordt bevestigen
 * (§8.10). Zelfde Convex-backend als de web-veldweergave (stap 9a).
 *
 * Bewuste keuzes t.o.v. web:
 * - Kantoor-capabilities (andermans dag, dag heropenen) bestaan hier niet;
 *   dat blijft webwerk. Mobiel is het altijd je eigen dag.
 * - Concepten, correcties en bezoekmeldingen gaan via een accountgebonden
 *   offline wachtrij. Definitief indienen vraagt serverbevestiging.
 * - "Buiten"-modus is een hoog-contrast licht thema over de theme-tokens,
 *   persistent per gebruiker (bijlage C).
 */

import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import React, { Component, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { ChevronLeft, ChevronRight, CloudOff, Lock, Sun, UserX } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import type { WerkbezoekDagData } from '../../components/veld/WerkbezoekDag';
import { AfsluitenKaart, DagVoortgang, KlusLijst } from '../../components/veld/MijnDagOverzicht';
import { VeldWachtrij } from '../../components/veld/VeldWachtrij';
import { geldigeDag, schuifDag, vandaagAmsterdam, werkPeriode } from '../../lib/werk-periode';
import { dagLabel, dagNummer, periodeLabel, weekNummer, weekdagKort } from '../../lib/datum-labels';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Button, OfflineIndicator, SkeletonCard } from '../../components/ui';
import {
  BuitenModusProvider,
  NoodprotocolKnop,
  SegmentenLijst,
  useBuitenModus,
} from '../../components/veld';
import { Drukvlak, LegeStaat, Melding, WeekStrook } from '../../components/werk/Bouwstenen';
import { isInternalRole } from '../../lib/roles';
import { tekst, useColors } from '../../theme';
import type { VeldDagData, VeldInstellingenData } from '../../types/veld';

function toonFout(fout: unknown, fallback: string) {
  const bericht =
    fout instanceof Error && fout.message ? fout.message : fallback;
  Alert.alert('Let op', bericht.replace(/^.*Uncaught ConvexError:?\s*/, ''));
}

// ============================================
// Scherm
// ============================================

export default function UrenScreen() {
  const { user, isLoading, role } = useCurrentUser();
  const kleuren = useColors();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: kleuren.background }}>
        <ActivityIndicator accessibilityLabel="Je dag laden" color={kleuren.primary} />
      </SafeAreaView>
    );
  }

  if (!isInternalRole(role)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
          <LegeStaat
            icoon={Lock}
            titel="Geen toegang"
            uitleg="De urenregistratie is alleen beschikbaar voor medewerkers van Top Tuinen."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BuitenModusProvider userId={user?._id ? String(user._id) : null}>
      <VeldFoutgrens>
        <MijnDag />
      </VeldFoutgrens>
    </BuitenModusProvider>
  );
}

function MijnDag() {
  const { buiten, toggleBuiten, kleuren } = useBuitenModus();
  const params = useLocalSearchParams<{ datum?: string }>();
  const vandaag = vandaagAmsterdam();
  const [datum, setDatum] = useState(() => geldigeDag(params.datum) ? params.datum : vandaagAmsterdam());
  const [routeDatum, setRouteDatum] = useState(params.datum);
  if (routeDatum !== params.datum) {
    setRouteDatum(params.datum);
    if (geldigeDag(params.datum)) setDatum(params.datum);
  }
  const { wachtrij } = useVeldOpdracht();
  const { online, voerUit } = useVeldServerActie();

  const liveDag = useQuery(api.urenSegmenten.getVeldDag, { datum }) as
    | VeldDagData
    | null
    | undefined;
  const { data: dag, uitCache } = useVeldCache(`dag:${datum}`, liveDag);
  const bezoekLive = useQuery(api.werkbezoek.getVoorDag, { datum }) as WerkbezoekDagData | undefined;
  const { data: bezoekDag } = useVeldCache(`bezoeken:${datum}`, bezoekLive);
  const veldInstellingen = useQuery(api.instellingen.getVeldInstellingen, {}) as
    | VeldInstellingenData
    | undefined;

  const [bezigMetIndienen, setBezigMetIndienen] = useState(false);

  const isIngediend = dag?.dagStatus === 'ingediend';
  // Ingediende dag is read-only; heropenen/corrigeren is kantoorwerk (web)
  const magBewerken = dag != null && !isIngediend;

  const week = werkPeriode(datum, 'week');
  const weekDagen = Array.from({ length: 7 }, (_, i) => schuifDag(week.van, i));

  // Waarom "Dag indienen" (nog) niet kan — dezelfde voorwaarden als de knop.
  const indienBlokkade = !dag
    ? null
    : !online
      ? 'Je bent offline. Indienen kan zodra je verbinding hebt.'
      : uitCache
        ? 'Je ziet een opgeslagen dag. Indienen kan zodra de actuele dag geladen is.'
        : wachtrij.length > 0
          ? 'Er staat nog invoer in de wachtrij. Synchroniseer die eerst.'
          : dag.segmenten.length === 0
            ? 'Nog geen uren gelogd voor deze dag.'
            : !bezoekLive?.gereed
              ? bezoekLive === undefined
                ? 'Je klussen worden geladen.'
                : 'Werk eerst de open punten bovenaan af.'
              : null;

  const handleDienIn = () => {
    if (!online || !dag || dag.segmenten.length === 0 || wachtrij.length > 0 || uitCache || !bezoekLive?.gereed) return;
    Alert.alert(
      'Dag indienen',
      `${dag.segmenten.length} segment${dag.segmenten.length === 1 ? '' : 'en'} indienen? Daarna staan je uren op slot; kantoor kan ze zo nodig heropenen. Bezoekmeldingen blijven aanvulbaar.`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Dien in',
          onPress: async () => {
            setBezigMetIndienen(true);
            try {
              await voerUit('urenSegmenten:dienDagIn', { datum });
            } catch (fout) {
              toonFout(fout, 'Dag indienen is mislukt');
            } finally {
              setBezigMetIndienen(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <OfflineIndicator style={{ marginHorizontal: 16 }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Kop: grote titel + buiten-modus + noodprotocol */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]} numberOfLines={1}>
              Mijn dag
            </Text>
            <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: 2 }]} numberOfLines={2}>
              {dagLabel(datum)}{dag?.team ? ` · ${dag.team.naam}` : ''}
            </Text>
          </View>
          <Drukvlak
            onPress={toggleBuiten}
            haptic="selection"
            accessibilityLabel="Buiten-modus"
            accessibilityHint="Hoog contrast voor fel daglicht"
            accessibilityRole="switch"
            accessibilityState={{ checked: buiten }}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: buiten ? kleuren.primary : kleuren.muted }}
          >
            <Sun size={21} color={buiten ? kleuren.primaryForeground : kleuren.foreground} strokeWidth={2} />
          </Drukvlak>
          <NoodprotocolKnop tekst={veldInstellingen?.noodprotocolTekst ?? null} />
        </View>

        {/* Week-navigatie */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: -6 }}>
          <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, flex: 1, fontWeight: '600' }]} numberOfLines={1}>
            Week {weekNummer(week.van)} · {periodeLabel(week.van, week.tot)}
          </Text>
          {datum !== vandaag && (
            <Drukvlak onPress={() => setDatum(vandaag)} haptic="selection" accessibilityLabel="Naar vandaag" style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: kleuren.primarySoft }}>
              <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600' }]}>Vandaag</Text>
            </Drukvlak>
          )}
          {([-7, 7] as const).map(stap => {
            const Pijl = stap < 0 ? ChevronLeft : ChevronRight;
            return (
              <Drukvlak key={stap} onPress={() => setDatum(d => schuifDag(d, stap))} haptic="selection" hitSlop={4} accessibilityLabel={stap < 0 ? 'Vorige week' : 'Volgende week'} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Pijl size={20} color={kleuren.foreground} strokeWidth={2.25} />
              </Drukvlak>
            );
          })}
        </View>
        <WeekStrook
          dagen={weekDagen}
          gekozen={datum}
          vandaag={vandaag}
          onKies={setDatum}
          labelVan={(d) => ({ kort: weekdagKort(d), nummer: dagNummer(d), voluit: dagLabel(d) })}
        />

        <VeldWachtrij />
        {uitCache && (
          <Melding
            icoon={CloudOff}
            tekst="Opgeslagen dag op dit toestel. Nieuwe invoer wordt gesynchroniseerd zodra je verbinding hebt."
          />
        )}

        {dag === undefined ? (
          <View accessibilityLabel="Dag laden" style={{ gap: 10 }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </View>
        ) : dag === null ? (
          // Kantoor-account zonder medewerker-koppeling (backend geeft null);
          // andermans dag bekijken/kiezen is kantoorwerk op web.
          <LegeStaat
            icoon={UserX}
            titel="Account niet gekoppeld"
            uitleg="Je account is niet aan een medewerker gekoppeld. Gebruik de webversie om de dag van een medewerker te bekijken."
          />
        ) : (
          <>
            <DagVoortgang dag={dag} bezoekDag={bezoekDag} datum={datum} isIngediend={isIngediend} />
            <KlusLijst dag={dag} bezoekDag={bezoekDag} datum={datum} />
            <SegmentenLijst dag={dag} datum={datum} magBewerken={magBewerken} />
            <AfsluitenKaart
              datum={datum}
              teamId={dag.team?._id}
              isIngediend={isIngediend}
              blokkade={indienBlokkade}
              bezig={bezigMetIndienen}
              onIndienen={handleDienIn}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// Foutgrens: Convex-query's gooien in render (bv. account zonder
// medewerker-koppeling). Toon een vriendelijke melding i.p.v. een crash.
// ============================================

class VeldFoutgrens extends Component<
  { children: ReactNode },
  { fout: string | null }
> {
  state = { fout: null as string | null };

  static getDerivedStateFromError(fout: unknown) {
    const bericht =
      fout instanceof Error && fout.message
        ? fout.message.replace(/^.*Uncaught ConvexError:?\s*/, '')
        : 'Er ging iets mis bij het laden van je dag.';
    return { fout: bericht };
  }

  render() {
    if (this.state.fout) {
      return <FoutScherm fout={this.state.fout} onOpnieuw={() => this.setState({ fout: null })} />;
    }
    return this.props.children;
  }
}

/** Kleuren via hooks kan niet in de klasse; dit scherm volgt licht/donker. */
function FoutScherm({ fout, onOpnieuw }: { fout: string; onOpnieuw: () => void }) {
  const kleuren = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <LegeStaat
          icoon={CloudOff}
          titel="Mijn dag kan niet laden"
          uitleg={fout}
          actie={<Button variant="outline" size="sm" title="Opnieuw proberen" onPress={onOpnieuw} />}
        />
      </View>
    </SafeAreaView>
  );
}
