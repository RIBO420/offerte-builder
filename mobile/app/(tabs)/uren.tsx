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
 * - Online-only, net als de Hub: segment-bevestigen praat direct met Convex.
 * - "Buiten"-modus is een hoog-contrast licht thema over de theme-tokens,
 *   persistent per gebruiker (bijlage C).
 */

import React, { Component, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Send,
  Sun,
} from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Badge, Button, OfflineIndicator } from '../../components/ui';
import {
  BuitenModusProvider,
  KlantblokKaart,
  NoodprotocolKnop,
  SegmentenLijst,
  useBuitenModus,
} from '../../components/veld';
import type { VeldDagData, VeldInstellingenData } from '../../types/veld';

// ============================================
// Datum-helpers (zonder Intl — Hermes-veilig)
// ============================================

const DAGEN = [
  'zondag',
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
];
const MAANDEN = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

function naarIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function vandaagIso(): string {
  return naarIso(new Date());
}

function schuifDag(datum: string, dagen: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + dagen);
  return naarIso(d);
}

function datumLabel(datum: string): string {
  const d = new Date(`${datum}T00:00:00`);
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`;
}

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

  // Klant-rol (mobiel: 'viewer') hoort de veld-schermen nooit te zien
  if (!isLoading && role === 'viewer') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <Text style={{ color: '#E8E8E8', fontSize: 16, fontWeight: '600' }}>
            Geen toegang
          </Text>
          <Text
            style={{
              color: '#999999',
              fontSize: 13,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            De urenregistratie is alleen beschikbaar voor medewerkers van Top
            Tuinen.
          </Text>
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
  const [datum, setDatum] = useState(vandaagIso());

  const dag = useQuery(api.urenSegmenten.getVeldDag, { datum }) as
    | VeldDagData
    | null
    | undefined;
  const veldInstellingen = useQuery(api.instellingen.getVeldInstellingen, {}) as
    | VeldInstellingenData
    | undefined;

  const dienDagIn = useMutation(api.urenSegmenten.dienDagIn);
  const [bezigMetIndienen, setBezigMetIndienen] = useState(false);

  const isIngediend = dag?.dagStatus === 'ingediend';
  // Ingediende dag is read-only; heropenen/corrigeren is kantoorwerk (web)
  const magBewerken = dag != null && !isIngediend;

  const label = useMemo(() => datumLabel(datum), [datum]);

  const handleDienIn = () => {
    if (!dag || dag.segmenten.length === 0) return;
    Alert.alert(
      'Dag indienen',
      `${dag.segmenten.length} segment${dag.segmenten.length === 1 ? '' : 'en'} indienen? Daarna staat de dag op slot; kantoor kan hem zo nodig heropenen.`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Dien in',
          onPress: async () => {
            setBezigMetIndienen(true);
            try {
              await dienDagIn({ datum });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }}>
      <OfflineIndicator />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }}
      >
        {/* Kop: titel + buiten-modus + noodprotocol */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <View style={{ flexShrink: 1 }}>
            <Text
              style={{
                color: kleuren.secondaryForeground,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              TOP TUINEN
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                color: kleuren.foreground,
                fontSize: 24,
                fontWeight: '600',
                marginTop: 4,
              }}
            >
              Mijn dag
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant={buiten ? 'primary' : 'outline'}
              size="sm"
              title="Buiten"
              icon={
                <Sun
                  size={16}
                  color={buiten ? kleuren.primaryForeground : kleuren.foreground}
                />
              }
              onPress={toggleBuiten}
            />
            <NoodprotocolKnop
              tekst={veldInstellingen?.noodprotocolTekst ?? null}
            />
          </View>
        </View>

        {/* Datum-navigatie */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vorige dag"
            hitSlop={8}
            onPress={() => setDatum((d) => schuifDag(d, -1))}
            style={{
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: kleuren.border,
            }}
          >
            <ChevronLeft size={18} color={kleuren.foreground} />
          </Pressable>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: kleuren.border,
            }}
          >
            <CalendarDays size={16} color={kleuren.mutedForeground} />
            <Text
              style={{
                color: kleuren.foreground,
                fontSize: 14,
                fontWeight: '500',
                textTransform: 'capitalize',
              }}
            >
              {label}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volgende dag"
            hitSlop={8}
            onPress={() => setDatum((d) => schuifDag(d, 1))}
            style={{
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: kleuren.border,
            }}
          >
            <ChevronRight size={18} color={kleuren.foreground} />
          </Pressable>
        </View>
        {datum !== vandaagIso() && (
          <Button
            variant="ghost"
            size="sm"
            title="Naar vandaag"
            onPress={() => setDatum(vandaagIso())}
          />
        )}

        {dag === undefined ? (
          <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
            Dag laden…
          </Text>
        ) : dag === null ? (
          // Kantoor-account zonder medewerker-koppeling (backend geeft null);
          // andermans dag bekijken/kiezen is kantoorwerk op web.
          <Text style={{ color: kleuren.mutedForeground, fontSize: 13 }}>
            Je account is niet aan een medewerker gekoppeld. Gebruik de
            webversie om de dag van een medewerker te bekijken.
          </Text>
        ) : (
          <>
            {/* Dag-status */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Lock
                size={14}
                color={
                  isIngediend ? kleuren.foreground : kleuren.mutedForeground
                }
                style={{ display: isIngediend ? 'flex' : 'none' }}
              />
              <LockOpen
                size={14}
                color={kleuren.mutedForeground}
                style={{ display: isIngediend ? 'none' : 'flex' }}
              />
              <Badge variant={isIngediend ? 'secondary' : 'outline'}>
                {isIngediend ? 'Ingediend' : 'Open'}
              </Badge>
              <Text
                style={{ color: kleuren.mutedForeground, fontSize: 13 }}
                numberOfLines={1}
              >
                {dag.medewerker.naam}
                {dag.team
                  ? ` — team ${dag.team.naam}`
                  : ' — geen team-dag gepland'}
              </Text>
            </View>
            {isIngediend && (
              <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>
                Deze dag is ingediend en op slot. Alleen kantoor kan hem
                heropenen en corrigeren (met log).
              </Text>
            )}

            {/* Klantblokken van de team-dag */}
            {dag.stops.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: kleuren.foreground,
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  Geplande klussen
                </Text>
                {dag.stops.map((stop) => (
                  <KlantblokKaart
                    key={String(stop.werkitemId)}
                    stop={stop}
                    datum={datum}
                    magBewerken={magBewerken}
                  />
                ))}
              </View>
            )}

            {/* Urensegmenten: voorstellen bevestigen + eigen segmenten */}
            <SegmentenLijst dag={dag} datum={datum} magBewerken={magBewerken} />

            {/* Dag indienen */}
            {!isIngediend && (
              <Button
                title="Dag indienen"
                size="lg"
                icon={<Send size={18} color={kleuren.primaryForeground} />}
                onPress={handleDienIn}
                loading={bezigMetIndienen}
                disabled={dag.segmenten.length === 0}
                fullWidth
              />
            )}
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
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              gap: 12,
            }}
          >
            <Text
              style={{ color: '#E8E8E8', fontSize: 16, fontWeight: '600' }}
            >
              Mijn dag kan niet laden
            </Text>
            <Text
              style={{ color: '#999999', fontSize: 13, textAlign: 'center' }}
            >
              {this.state.fout}
            </Text>
            <Button
              variant="outline"
              size="sm"
              title="Opnieuw proberen"
              onPress={() => this.setState({ fout: null })}
            />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}
