import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Circle, Lock, Send, Truck } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { Button } from '../ui';
import { Drukvlak, IcoonTegel, Kaart, Scheiding, SectieKop } from '../werk/Bouwstenen';
import { urenLabel } from '../../lib/werk-periode';
import { tekst } from '../../theme';
import type { VeldDagData } from '../../types/veld';
import { RETOUR_KEUZES } from './AanhangerRetourKaart';
import { useVeldKleuren } from './BuitenModus';
import type { Bezoek, Onderdeel, WerkbezoekDagData } from './WerkbezoekDag';

/** Wat je per klus meldt, in de volgorde van het klusscherm. */
const KLUS_ONDERDELEN: [Onderdeel, string][] = [['afronding', 'Terugmelden'], ['afvoer', 'Afval'], ['foto', 'Foto']];

interface KlusRij { id: string; naam: string; sub: string | null; bezoek?: Bezoek }

/** Geplande stops plus bezoeken waar je zonder planning hebt gewerkt. */
function klussenVan(dag: VeldDagData, bezoekDag: WerkbezoekDagData | undefined): KlusRij[] {
  const rijen: KlusRij[] = dag.stops.map(stop => ({
    id: String(stop.werkitemId),
    naam: stop.klantNaam ?? stop.naam,
    sub: [stop.adres?.split(',')[0], stop.geplandeMinuten ? `${urenLabel(stop.geplandeMinuten)} gepland` : null].filter(Boolean).join(' · ') || null,
    bezoek: bezoekDag?.bezoeken.find(b => String(b.werkitemId) === String(stop.werkitemId)),
  }));
  for (const bezoek of bezoekDag?.bezoeken ?? []) {
    if (!rijen.some(r => r.id === String(bezoek.werkitemId))) rijen.push({ id: String(bezoek.werkitemId), naam: bezoek.klantNaam ?? bezoek.naam, sub: 'Niet ingepland', bezoek });
  }
  return rijen;
}

function useOpenKlus(datum: string) {
  const router = useRouter();
  return (rij: KlusRij) => router.push({ pathname: '/werk/klus/[id]', params: { id: rij.id, datum, naam: rij.naam } });
}

/**
 * Bovenaan Mijn dag: wat er nog moet gebeuren voordat je kunt indienen, of dat
 * de dag klaar of al ingediend is. Elke regel springt naar de plek waar het kan.
 */
export function DagVoortgang({ dag, bezoekDag, datum, isIngediend, onUren }: { dag: VeldDagData; bezoekDag: WerkbezoekDagData | undefined; datum: string; isIngediend: boolean; onUren?: () => void }) {
  const kleuren = useVeldKleuren();
  const openKlus = useOpenKlus(datum);
  if (isIngediend) {
    return (
      <Kaart style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IcoonTegel icoon={Lock} toon="succes" grootte={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground }]}>Dag ingediend</Text>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>Je uren staan op slot. Bezoekmeldingen kun je nog aanvullen.</Text>
        </View>
      </Kaart>
    );
  }
  const open: { sleutel: string; tekst: string; onPress?: () => void }[] = [];
  if (dag.voorstellen.length > 0) open.push({ sleutel: 'voorstel', tekst: `Uren uit je dagkaart bevestigen (${dag.voorstellen.length})`, onPress: onUren });
  else if (dag.segmenten.length === 0) open.push({ sleutel: 'uren', tekst: 'Uren invullen', onPress: onUren });
  for (const rij of klussenVan(dag, bezoekDag)) {
    if (!rij.bezoek || rij.bezoek.gereed) continue;
    const mist = KLUS_ONDERDELEN.filter(([o]) => rij.bezoek!.ontbreekt.includes(o)).map(([, label]) => label.toLowerCase());
    if (mist.length) open.push({ sleutel: rij.id, tekst: `${rij.naam}: ${mist.join(', ')}`, onPress: () => openKlus(rij) });
  }
  const klaar = open.length === 0;
  return (
    <Kaart variant={klaar ? 'natuur' : 'standaard'} style={{ gap: klaar ? 4 : 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>
            {klaar ? 'Klaar om in te dienen' : open.length === 1 ? 'Nog 1 ding voor je indient' : `Nog ${open.length} dingen voor je indient`}
          </Text>
          {klaar && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>Controleer je uren en dien onderaan je dag in.</Text>}
        </View>
        {!klaar && <OpenTeller aantal={open.length} />}
      </View>
      {open.map(item => {
        const regel = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}>
            <Circle size={16} color={kleuren.warning} strokeWidth={2.25} />
            <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{item.tekst}</Text>
            {item.onPress && <ChevronRight size={18} color={kleuren.mutedForeground} strokeWidth={2} />}
          </View>
        );
        return item.onPress ? <Drukvlak key={item.sleutel} onPress={item.onPress} accessibilityLabel={item.tekst} accessibilityHint={item.sleutel === 'voorstel' || item.sleutel === 'uren' ? 'Gaat naar je uren' : 'Opent de klus'}>{regel}</Drukvlak> : <View key={item.sleutel}>{regel}</View>;
      })}
    </Kaart>
  );
}

/** Klein rond getal met het aantal open punten. */
function OpenTeller({ aantal }: { aantal: number }) {
  const kleuren = useVeldKleuren();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.warningSoft }}>
      <Text style={[tekst.kop, tekst.cijfers, { color: kleuren.warning }]}>{aantal}</Text>
    </View>
  );
}

/** Eén regel per klus; tikken opent het klusscherm met alles van die klus. */
export function KlusLijst({ dag, bezoekDag, datum }: { dag: VeldDagData; bezoekDag: WerkbezoekDagData | undefined; datum: string }) {
  const kleuren = useVeldKleuren();
  const openKlus = useOpenKlus(datum);
  const rijen = klussenVan(dag, bezoekDag);
  if (!rijen.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <SectieKop titel="Klussen" telling={rijen.length} />
      <Kaart padding={4} style={{ paddingHorizontal: 16, gap: 0 }}>
        {rijen.map((rij, i) => {
          const status = rij.bezoek ? KLUS_ONDERDELEN.map(([o, label]) => ({ label, af: !rij.bezoek!.ontbreekt.includes(o) })) : [];
          const label = [rij.naam, rij.sub, ...status.map(s => `${s.label} ${s.af ? 'gedaan' : 'open'}`)].filter(Boolean).join(', ');
          return (
            <View key={rij.id}>
              {i > 0 && <Scheiding />}
              <Drukvlak onPress={() => openKlus(rij)} accessibilityLabel={label} accessibilityHint="Opent de klus" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ gap: 1 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={1}>{rij.naam}</Text>
                    {rij.sub && <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{rij.sub}</Text>}
                  </View>
                  {status.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
                      {status.map(s => (
                        <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          {s.af ? <Check size={14} color={kleuren.success} strokeWidth={2.75} /> : <Circle size={12} color={kleuren.mutedForeground} strokeWidth={2.25} />}
                          <Text style={[tekst.voetnoot, { color: s.af ? kleuren.foreground : kleuren.mutedForeground, fontSize: 14 }]}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color={kleuren.mutedForeground} strokeWidth={2} />
              </Drukvlak>
            </View>
          );
        })}
      </Kaart>
    </View>
  );
}

interface RetourSamenvatting { retouren: { keuze: string; gemeldDoorNaam: string }[]; magMelden: boolean }

/** Laatste stap: aanhanger melden en de dag indienen. */
export function AfsluitenKaart({ datum, teamId, isIngediend, blokkade, bezig, onIndienen }: {
  datum: string; teamId?: string; isIngediend: boolean; blokkade: string | null; bezig: boolean; onIndienen: () => void;
}) {
  const kleuren = useVeldKleuren();
  const router = useRouter();
  const { wachtrij } = useVeldOpdracht();
  const live = useQuery(api.aanhangerRetouren.getDag, { datum, ...(teamId ? { teamId: teamId as Id<'teams'> } : {}) }) as RetourSamenvatting | undefined;
  const { data: retour } = useVeldCache(`retour:${datum}:${teamId ?? 'eigen'}`, live);
  const laatste = retour?.retouren.at(-1);
  const wacht = wachtrij.some(r => r.type === 'retour' && r.payload.datum === datum);
  const aanhangerSub = wacht ? 'Wacht op verbinding'
    : laatste ? `${RETOUR_KEUZES.find(([k]) => k === laatste.keuze)?.[1] ?? 'Gemeld'} · ${laatste.gemeldDoorNaam}${retour!.retouren.length > 1 ? ` (+${retour!.retouren.length - 1})` : ''}`
      : retour === undefined ? 'Laden…' : 'Nog niet gemeld';
  return (
    <View style={{ gap: 10 }}>
      <SectieKop titel="Afsluiten" />
      <Kaart style={{ gap: 14 }}>
        <Drukvlak
          onPress={() => router.push({ pathname: '/werk/aanhanger', params: { datum, ...(teamId ? { teamId } : {}) } })}
          accessibilityLabel={`Aanhanger terug naar de loods, ${aanhangerSub}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
        >
          <IcoonTegel icoon={Truck} toon={laatste ? 'succes' : 'neutraal'} grootte={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[tekst.kop, { color: kleuren.foreground }]}>Aanhanger terug</Text>
            <Text style={[tekst.voetnoot, { color: wacht ? kleuren.warning : kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{aanhangerSub}</Text>
          </View>
          <ChevronRight size={20} color={kleuren.mutedForeground} strokeWidth={2} />
        </Drukvlak>
        {!isIngediend && <>
          <Scheiding />
          <View style={{ gap: 8 }}>
            <Button
              title="Dag indienen"
              size="lg"
              icon={<Send size={18} color={kleuren.primaryForeground} strokeWidth={2} />}
              onPress={onIndienen}
              loading={bezig}
              disabled={blokkade !== null}
              fullWidth
            />
            {blokkade && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, textAlign: 'center', fontSize: 14, lineHeight: 19 }]}>{blokkade}</Text>}
          </View>
        </>}
      </Kaart>
    </View>
  );
}
