/**
 * Tuinvenster-onderdelen (okt 2026): de kop met het tuinbeeld van het dagdeel en
 * de dagtijdlijn met blokken in de aardetint van het soort werk.
 *
 * De tuinbeelden zijn gegenereerd (prompt staat in elk JPEG-bestand); ze zijn
 * sfeer, geen projectfoto's van klanten.
 */

import React, { type ComponentType, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrickWall, Check, Coffee, Leaf, Shovel, Sprout, Truck, Warehouse } from 'lucide-react-native';
import { tekst, useColors } from '../../theme';
import type { VeldDagData } from '../../types/veld';
import { CATEGORIE_LABELS } from '../../types/veld';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const BEELDEN = {
  ochtend: require('../../assets/tuin/tuin-ochtend.jpg'),
  middag: require('../../assets/tuin/tuin-middag.jpg'),
  avond: require('../../assets/tuin/tuin-avond.jpg'),
} as const;

export type Dagdeel = keyof typeof BEELDEN;

export function dagdeelVan(nu = new Date()): Dagdeel {
  const uur = nu.getHours();
  if (uur < 11) return 'ochtend';
  if (uur < 18) return 'middag';
  return 'avond';
}

export function groetVan(deel: Dagdeel): string {
  return deel === 'ochtend' ? 'Goedemorgen' : deel === 'middag' ? 'Goedemiddag' : 'Goedenavond';
}

// ── TuinKop ─────────────────────────────────────────────────────────────────

/**
 * Tuinbeeld achter de statusbalk, met bovenin een zachte verduistering voor de
 * witte tekst en onderin een overloop naar de achtergrond, zodat de eerste kaart
 * er half overheen kan liggen. Bewust laag (rustig): de inhoud gaat voor.
 */
export function TuinKop({ titel, sub, rechts, hoogte = 196 }: { titel: string; sub?: string; rechts?: ReactNode; hoogte?: number }) {
  const kleuren = useColors();
  const insets = useSafeAreaInsets();
  const deel = dagdeelVan();
  return (
    <View style={{ height: hoogte + insets.top, marginHorizontal: -16, overflow: 'hidden' }}>
      <Image source={BEELDEN[deel]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 150 }}
      />
      <LinearGradient
        colors={[`${kleuren.background}00`, kleuren.background]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
      />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <View accessible accessibilityLabel="Top Tuinen" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Leaf size={16} color="#FFFFFF" strokeWidth={2.25} />
            <Text style={[tekst.sub, { color: '#FFFFFF', fontWeight: '600' }, schaduw]}>Top Tuinen</Text>
          </View>
          {rechts}
        </View>
        <Text accessibilityRole="header" style={[tekst.titel1, { color: '#FFFFFF' }, schaduw]} numberOfLines={2}>{titel}</Text>
        {sub ? <Text style={[tekst.sub, { color: 'rgba(255,255,255,0.92)' }, schaduw]} numberOfLines={2}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// Tekstschaduw: houdt wit leesbaar op lichte plekken van het beeld.
const schaduw = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

// ── DagTijdlijn ─────────────────────────────────────────────────────────────

export type WerkSoort = 'aanleg' | 'onderhoud' | 'bestrating' | 'loods' | 'reis' | 'pauze';

export interface DagItem {
  sleutel: string;
  begin: string;
  eind?: string;
  titel: string;
  sub?: string;
  soort: WerkSoort;
  klaar?: boolean;
  nu?: boolean;
}

const ICONEN: Record<WerkSoort, Icoon> = {
  aanleg: Shovel,
  onderhoud: Sprout,
  bestrating: BrickWall,
  loods: Warehouse,
  reis: Truck,
  pauze: Coffee,
};

const SOORT_LABEL: Record<WerkSoort, string> = {
  aanleg: 'Aanleg',
  onderhoud: 'Onderhoud',
  bestrating: 'Bestrating',
  loods: 'Loods',
  reis: 'Reizen',
  pauze: 'Pauze',
};

function tijdNu(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Zet een veld-dag om naar tijdlijnblokken: de geschreven segmenten als die er
 * zijn, anders het dagvoorstel. `isVandaag` bepaalt of "nu" gemarkeerd wordt.
 */
export function dagItemsVan(dag: VeldDagData, isVandaag: boolean): DagItem[] {
  const geschreven = dag.segmenten.length > 0;
  const bron: { categorie: string; beginTijd: string; eindTijd: string; werkitemId?: unknown; status?: string; _id?: unknown }[] =
    geschreven ? dag.segmenten : dag.voorstellen;
  const stops = new Map(dag.stops.map(s => [String(s.werkitemId), s]));
  const nu = tijdNu();
  return [...bron]
    .sort((a, b) => a.beginTijd.localeCompare(b.beginTijd))
    .map((r, i) => {
      const stop = r.werkitemId ? stops.get(String(r.werkitemId)) : undefined;
      let soort: WerkSoort;
      let titel: string;
      let sub: string | undefined;
      switch (r.categorie) {
        case 'werken':
          soort = stop?.type === 'onderhoudsbeurt' ? 'onderhoud' : 'aanleg';
          titel = stop?.klantNaam ?? stop?.naam ?? 'Werk';
          sub = stop?.klantNaam ? `${SOORT_LABEL[soort]} · ${stop.naam}` : SOORT_LABEL[soort];
          break;
        case 'pauze':
          soort = 'pauze';
          titel = 'Pauze';
          break;
        case 'reistijd':
          soort = 'reis';
          titel = 'Reizen';
          break;
        default:
          soort = 'loods';
          titel = CATEGORIE_LABELS[r.categorie as keyof typeof CATEGORIE_LABELS] ?? 'Loods';
      }
      return {
        sleutel: `${String(r._id ?? i)}-${r.beginTijd}`,
        begin: r.beginTijd,
        eind: r.eindTijd,
        titel,
        sub,
        soort,
        klaar: geschreven && r.status !== 'concept',
        nu: isVandaag && r.beginTijd <= nu && nu < r.eindTijd,
      };
    });
}

export function DagTijdlijn({ items }: { items: DagItem[] }) {
  const kleuren = useColors();
  const kleurVan = (s: WerkSoort) =>
    s === 'aanleg' ? kleuren.werkAanleg
      : s === 'onderhoud' ? kleuren.werkOnderhoud
        : s === 'bestrating' ? kleuren.werkBestrating
          : s === 'reis' ? kleuren.werkReis
            : s === 'pauze' ? kleuren.werkPauze
              : kleuren.werkLoods;
  return (
    <View style={{ gap: 8 }}>
      {items.map((item, i) => {
        const I = ICONEN[item.soort];
        const pauze = item.soort === 'pauze';
        const voor = pauze ? kleuren.foreground : '#FFFFFF';
        const tijd = item.eind ? `${item.begin} tot ${item.eind}` : item.begin;
        return (
          <View key={item.sleutel} style={{ flexDirection: 'row', gap: 10 }}>
            {/* Tijdkolom met doorlopende lijn en een stip op "nu". */}
            <View style={{ width: 44, alignItems: 'flex-start' }}>
              <Text style={[tekst.voetnoot, tekst.cijfers, { color: item.nu ? kleuren.primary : kleuren.mutedForeground, fontWeight: item.nu ? '700' : '500', marginTop: 12 }]}>
                {item.begin}
              </Text>
            </View>
            <View style={{ width: 10, alignItems: 'center' }}>
              <View style={{ position: 'absolute', top: i === 0 ? 18 : 0, bottom: i === items.length - 1 ? undefined : -8, height: i === items.length - 1 ? 18 : undefined, width: 2, borderRadius: 1, backgroundColor: kleuren.border }} />
              <View style={{ marginTop: 14, width: item.nu ? 10 : 8, height: item.nu ? 10 : 8, borderRadius: 5, backgroundColor: item.nu ? kleuren.primary : item.klaar ? kleuren.mutedForeground : kleuren.background, borderWidth: item.nu || item.klaar ? 0 : 2, borderColor: kleuren.mutedForeground }} />
            </View>
            <View
              accessible
              accessibilityLabel={`${tijd}, ${item.titel}${item.sub ? `, ${item.sub}` : ''}${item.klaar ? ', geschreven' : ''}${item.nu ? ', nu bezig' : ''}`}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minHeight: pauze ? 40 : 52,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: kleurVan(item.soort),
                borderWidth: item.nu ? 2 : 0,
                borderColor: kleuren.primary,
              }}
            >
              <I size={18} color={pauze ? kleuren.mutedForeground : 'rgba(255,255,255,0.92)'} strokeWidth={2} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[tekst.kop, { color: voor, fontSize: 16 }]} numberOfLines={1}>{item.titel}</Text>
                {item.sub ? <Text style={[tekst.voetnoot, { color: pauze ? kleuren.mutedForeground : 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>{item.sub}</Text> : null}
              </View>
              {item.klaar && (
                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: pauze ? kleuren.primarySoft : 'rgba(255,255,255,0.22)' }}>
                  <Check size={14} color={pauze ? kleuren.primary : '#FFFFFF'} strokeWidth={3} />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
